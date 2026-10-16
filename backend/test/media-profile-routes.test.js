import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {HttpProblem} from '../src/security.js';
import {registerMediaProfileRoutes} from '../src/media-profile.js';

const tenant='11111111-1111-4111-8111-111111111111';
const foreign='22222222-2222-4222-8222-222222222222';
const ownBarber='44444444-4444-4444-8444-444444444444';
async function setup(role='owner'){
 const app=Fastify();
 const calls=[],uploads=[];
 const db={query:async(sql,args)=>{
  calls.push({sql,args});
  if(sql.includes('SELECT 1 FROM public.barbers'))return {rowCount:args?.[1]===ownBarber?1:0,rows:args?.[1]===ownBarber?[{}]:[]};
  if(sql.includes('UPDATE public.barbers SET name=$4,bio=$5')) {
    const allowed=args?.[0]===tenant&&args?.[1]===ownBarber&&args?.[2]==='33333333-3333-4333-8333-333333333333';
    return {rowCount:allowed?1:0,rows:allowed?[{id:ownBarber,name:args?.[3]}]:[]};
  }
  return {rowCount:1,rows:[{id:tenant,portfolio:args?.[1]||[]}]};
 }};
 const security={
  authenticated:async req=>{req.actor={id:'33333333-3333-4333-8333-333333333333'};},
  limited:async()=>{},
  requireTenant:async(_db,id,_user,roles)=>{
   if(id!==tenant)throw new HttpProblem(403,'Sin acceso a esta empresa');
   if(!roles.includes(role))throw new HttpProblem(403,'Sin permiso para modificar este recurso');
   return role;
  },
  service:{storage:{from:(bucket)=>({
   upload:async(path,buffer,settings)=>{uploads.push({bucket,path,buffer,settings});return {error:null};},
   getPublicUrl:path=>({data:{publicUrl:'https://storage.example.com/'+path}})
  })}}
 };
 await registerMediaProfileRoutes(app,{db,security,config:{mediaBucket:'barberos-images'}});
 await app.ready();
 return {app,calls,uploads};
}
test('shop owner uploads a verified JPEG with a tenant-prefixed storage path',async()=>{
 const {app,uploads}=await setup();
 try{
  const data=Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(30)]).toString('base64');
  const result=await app.inject({method:'POST',url:'/api/v1/tenants/'+tenant+'/images',payload:{data,category:'products'}});
  assert.equal(result.statusCode,201,result.body);
  assert.match(result.json().url,/^https:\/\/storage.example.com\//);
  assert.equal(uploads.length,1);
  assert.equal(uploads[0].bucket,'barberos-images');
  assert.match(uploads[0].path,new RegExp('^'+tenant+'/products/'));
  assert.equal(uploads[0].settings.contentType,'image/jpeg');
 }finally{await app.close();}
});
test('invalid image and foreign-tenant upload are denied',async()=>{
 const {app,uploads}=await setup();
 try{
  const invalid=await app.inject({method:'POST',url:'/api/v1/tenants/'+tenant+'/images',payload:{data:Buffer.from('not a jpg image').toString('base64'),category:'products'}});
  assert.equal(invalid.statusCode,400,invalid.body);
  const foreignResult=await app.inject({method:'POST',url:'/api/v1/tenants/'+foreign+'/images',payload:{data:Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(30)]).toString('base64'),category:'products'}});
  assert.equal(foreignResult.statusCode,403,foreignResult.body);
  assert.equal(uploads.length,0);
 }finally{await app.close();}
});
test('profile fields persist and gallery limit is enforced server-side',async()=>{
 const {app,calls}=await setup();
 try{
  const valid=await app.inject({method:'PATCH',url:'/api/v1/tenants/'+tenant+'/profile',payload:{name:'Barbería Prueba',tagline:'Cortes',address:'Calle 1',city:'Bogotá',phone:'3001234567'}});
  assert.equal(valid.statusCode,200,valid.body);
  assert.ok(calls.some(call=>call.sql.includes('UPDATE public.tenants')));
  const many=await app.inject({method:'PATCH',url:'/api/v1/tenants/'+tenant+'/gallery',payload:{photos:Array.from({length:11},(_,i)=>'https://example.com/'+i+'.jpg')}});
  assert.equal(many.statusCode,400,many.body);
 }finally{await app.close();}
});

test('barber can upload personal media, but cannot edit another barber or business media',async()=>{
 const {app,uploads}=await setup('barber');
 try{
  const data=Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(30)]).toString('base64');
  const own=await app.inject({method:'POST',url:'/api/v1/tenants/'+tenant+'/images',payload:{data,category:'barber'}});
  assert.equal(own.statusCode,201,own.body);
  const shop=await app.inject({method:'POST',url:'/api/v1/tenants/'+tenant+'/images',payload:{data,category:'shop'}});
  assert.equal(shop.statusCode,403,shop.body);
  const ownPhoto=await app.inject({method:'PATCH',url:'/api/v1/tenants/'+tenant+'/barbers/'+ownBarber+'/photo',
   payload:{url:'https://example.com/photo.jpg'}});
  assert.equal(ownPhoto.statusCode,200,ownPhoto.body);
  const foreignPhoto=await app.inject({method:'PATCH',url:'/api/v1/tenants/'+tenant+'/barbers/'+foreign+'/photo',
   payload:{url:'https://example.com/photo.jpg'}});
  assert.equal(foreignPhoto.statusCode,403,foreignPhoto.body);
  const foreignGallery=await app.inject({method:'PATCH',url:'/api/v1/tenants/'+tenant+'/barbers/'+foreign+'/gallery',
   payload:{photos:['https://example.com/photo.jpg']}});
  assert.equal(foreignGallery.statusCode,403,foreignGallery.body);
  assert.equal(uploads.length,1);
 }finally{await app.close();}
});

test('owner can persist full commercial profile and conditions; barbers cannot change contracts',async()=>{
 const {app,calls}=await setup();
 try{
  const payload={name:'Barbería QA',tagline:'Elegancia',address:'Calle 14',city:'Chía',
   phone:'3120000000',email:'qa@example.com',latitude:4.86,longitude:-74.04,
   openingHours:{days:'Lunes a sábado',open:'09:00',close:'20:00'},
   socialLinks:{instagram:'@barberiaqa',whatsapp:'3120000000'}};
  const result=await app.inject({method:'PATCH',url:'/api/v1/tenants/'+tenant+'/profile',payload});
  assert.equal(result.statusCode,200,result.body);
  const update=calls.find(v=>v.sql.includes('opening_hours='));
  assert.ok(update);
  assert.deepEqual(update.args.slice(8,10),[4.86,-74.04]);
  assert.equal(JSON.parse(update.args[10]).days,'Lunes a sábado');
  const path='/api/v1/tenants/'+tenant+'/barbers/'+ownBarber+'/contract';
  const contract=await app.inject({method:'PATCH',url:path,payload:{
    contractType:'hybrid',commissionRate:0.35,chairRentalFee:80000,
    chairRentalPeriod:'weekly',status:'active'}});
  assert.equal(contract.statusCode,200,contract.body);
  assert.ok(calls.some(v=>v.sql.includes('SET contract_type=')));
  const invalid=await app.inject({method:'PATCH',url:path,payload:{
    contractType:'chair_rental',commissionRate:0,chairRentalFee:0,
    chairRentalPeriod:'monthly',status:'active'}});
  assert.equal(invalid.statusCode,400,invalid.body);
 }finally{await app.close();}
 const {app:barberApp}=await setup('barber');
 try{
  const denied=await barberApp.inject({method:'PATCH',url:'/api/v1/tenants/'+tenant+'/barbers/'+ownBarber+'/contract',
   payload:{contractType:'commission',commissionRate:0.5,chairRentalFee:0,chairRentalPeriod:'monthly',status:'active'}});
  assert.equal(denied.statusCode,403);
 }finally{await barberApp.close();}
});


test('client without a tenant uploads an avatar only to their own authenticated path',async()=>{
 const {app,uploads}=await setup('owner');
 try{
  const photo=Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(30)]).toString('base64');
  const good=await app.inject({method:'POST',url:'/api/v1/me/avatar',payload:{data:photo}});
  assert.equal(good.statusCode,201,good.body);
  assert.match(uploads[0].path,/^avatars\/33333333-3333-4333-8333-333333333333\//);
  const forged=await app.inject({method:'POST',url:'/api/v1/me/avatar',payload:{data:photo,userId:foreign}});
  assert.equal(forged.statusCode,400,forged.body);
  const invalid=await app.inject({method:'POST',url:'/api/v1/me/avatar',payload:{data:Buffer.from('unsafe').toString('base64')}});
  assert.equal(invalid.statusCode,400,invalid.body);
  assert.equal(uploads.length,1,'Rejected images and forged identities are never stored');
 }finally{await app.close();}
});

test('professional details are writable by own barber or owner and constrained to own user_id',async()=>{
 const own=await setup('barber');
 try{
  const route='/api/v1/tenants/'+tenant+'/barbers/'+ownBarber+'/professional-profile';
  const payload={name:'Carlos Motas',bio:'Cortes clásicos y degradados.',
   specialties:['Corte clásico','Barba'],experienceYears:8,instagramUrl:'https://www.instagram.com/barber.carlos/',
   professionalPhone:'+573001112233'};
  const updated=await own.app.inject({method:'PATCH',url:route,payload});
  assert.equal(updated.statusCode,200,updated.body);
  const query=own.calls.find(x=>x.sql.includes('SET name=$4,bio=$5,specialties=$6'));
  assert.ok(query,'A professional update should be issued');
  assert.match(query.sql,/tenant_id=\$1 AND id=\$2 AND user_id=\$3/);
  assert.ok(!/commission|chair_rental|status=/.test(query.sql),'No salary or contract fields may be edited');
  const injection=await own.app.inject({method:'PATCH',url:route,payload:{...payload,commissionRate:1}});
  assert.equal(injection.statusCode,400,injection.body);
  const invalid=await own.app.inject({method:'PATCH',url:route,payload:{...payload,experienceYears:100}});
  assert.equal(invalid.statusCode,400,invalid.body);
 }finally{await own.app.close();}
 const owner=await setup('owner');
 try{
  const allowed=await owner.app.inject({method:'PATCH',url:'/api/v1/tenants/'+tenant+'/barbers/'+ownBarber+'/professional-profile',
   payload:{name:'Dueño barbero',bio:'Atiendo mis propias citas',specialties:['Barba'],experienceYears:6,instagramUrl:'',professionalPhone:''}});
  assert.equal(allowed.statusCode,200,allowed.body);
  const update=owner.calls.find(x=>x.sql.includes('SET name=$4,bio=$5'));
  assert.ok(update,'The owner may update an Auth-linked professional profile');
  assert.equal(update.args[2],'33333333-3333-4333-8333-333333333333','Owner edits must use server-resolved user identity');
  const denied=await owner.app.inject({method:'PATCH',url:'/api/v1/tenants/'+tenant+'/barbers/'+foreign+'/professional-profile',
   payload:{name:'Barbero ajeno',bio:'',specialties:[],experienceYears:0,instagramUrl:'',professionalPhone:''}});
  assert.equal(denied.statusCode,403,denied.body);
 }finally{await owner.app.close();}
});
