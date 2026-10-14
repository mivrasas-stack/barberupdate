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
 const db={query:async(sql,args)=>{calls.push({sql,args});if(sql.includes('SELECT 1 FROM public.barbers'))return {rowCount:args?.[1]===ownBarber?1:0,rows:args?.[1]===ownBarber?[{}]:[]};return {rowCount:1,rows:[{id:tenant,portfolio:args?.[1]||[]}]};}};
 const security={
  authenticated:async req=>{req.actor={id:'33333333-3333-4333-8333-333333333333'};},
  limited:async()=>{},
  requireTenant:async(_db,id,_user,roles)=>{
   if(id!==tenant)throw new HttpProblem(403,'Sin acceso a esta empresa');
   assert.ok(roles.includes(role));
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
  assert.ok(calls.some(call=>call.sql.includes('UPDATE public.tenants SET name=')));
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
