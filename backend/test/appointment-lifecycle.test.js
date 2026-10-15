import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerRoutes} from '../src/routes.js';
import {describeApiError} from '../src/app.js';

const tenant='11111111-1111-4111-8111-111111111111';
const aptId='22222222-2222-4222-8222-222222222222';
const owner='33333333-3333-4333-8333-333333333333';
const assignedBarber='44444444-4444-4444-8444-444444444444';
const url='/api/v1/tenants/'+tenant+'/appointments/'+aptId+'/status';

async function setup(initialStatus='confirmed',startOffsetMinutes=0,role='owner'){
 const app=Fastify({logger:false});
 const booking={id:aptId,tenant_id:tenant,barber_id:'55555555-5555-4555-8555-555555555555',
   barber_user_id:assignedBarber,status:initialStatus,
   starts_at:new Date(Date.now()+startOffsetMinutes*60000).toISOString()};
 const statements=[];
 const db={
  query:async(sql,args=[])=>{
   statements.push(sql);
   if(sql.includes('FROM public.appointments a JOIN public.barbers b')){
    return {rowCount:1,rows:[{...booking}]};
   }
   if(sql.includes('UPDATE public.appointments SET status=')){
    booking.status=args[2];booking.cancellation_reason=args[3]||null;
    return {rowCount:1,rows:[{...booking}]};
   }
   throw Error('Unexpected SQL '+sql.slice(0,120));
  },
  transaction:async fn=>fn(db)
 };
 const security={
  authenticated:async req=>{req.actor={id:owner,email:'owner@example.com'};},
  limited:async()=>{},
  requireTenant:async(_db,id,who,allowed)=>{
   if(id!==tenant||who!==owner||!allowed?.includes(role)){
    const e=new Error('Sin permisos');e.statusCode=403;throw e;
   }
   return role;
  }
 };
 app.setErrorHandler((error,_req,reply)=>{
  const {status,message}=describeApiError(error);
  reply.code(status).send({error:message});
 });
 await registerRoutes(app,{config:{},db,security});
 await app.ready();
 return {app,booking,statements};
}
const call=(app,status,reason)=>app.inject({method:'PATCH',url,payload:{
 status,...(['cancelled','no_show'].includes(status)?{reason:reason||'Cliente no asistió a la cita'}:{})
}});

test('confirmed booking can start service; completion requires a settled payment',async()=>{
 const {app,booking}=await setup();
 try{
  assert.equal((await call(app,'in_service')).statusCode,200);
  assert.equal(booking.status,'in_service');
  assert.equal((await call(app,'completed')).statusCode,409);
  assert.equal(booking.status,'in_service');
  assert.equal((await call(app,'cancelled')).statusCode,409);
 }finally{await app.close();}
});
test('no-show is blocked before booked start and inside 15-minute grace period',async()=>{
 for(const minutes of [90,0,-5]){
  const {app,booking}=await setup('confirmed',minutes);
  try{
   const reply=await call(app,'no_show');
   assert.equal(reply.statusCode,409,reply.body);
   assert.equal(booking.status,'confirmed');
  }finally{await app.close();}
 }
});
test('no-show after grace period and cancellation close booking without deleting it',async()=>{
 const noShow=await setup('confirmed',-20);
 try{
  const result=await call(noShow.app,'no_show');
  assert.equal(result.statusCode,200,result.body);
  assert.equal(noShow.booking.status,'no_show');
  assert.equal((await call(noShow.app,'in_service')).statusCode,409);
  assert.ok(noShow.statements.some(s=>s.includes('UPDATE public.appointments SET status=')));
  assert.ok(!noShow.statements.some(s=>s.includes('DELETE FROM public.appointments')));
 }finally{await noShow.app.close();}
 const canceled=await setup('confirmed',120);
 try{
  assert.equal((await call(canceled.app,'cancelled')).statusCode,200);
  assert.equal(canceled.booking.status,'cancelled');
  assert.equal((await call(canceled.app,'in_service')).statusCode,409);
 }finally{await canceled.app.close();}
});
test('pending booking starts instantly when the barbero confirms client arrival',async()=>{
 const {app}=await setup('pending',0);
 try{
  assert.equal((await call(app,'in_service')).statusCode,200);
  assert.equal((await call(app,'confirmed')).statusCode,409);
 }finally{await app.close();}
});

test('cancel or no-show must include a bounded real reason',async()=>{
 const fixture=await setup('confirmed',-20);
 try{
  assert.equal((await fixture.app.inject({method:'PATCH',url,payload:{status:'cancelled'}})).statusCode,400);
  assert.equal((await fixture.app.inject({method:'PATCH',url,payload:{status:'no_show',reason:'ab'}})).statusCode,400);
  const result=await call(fixture.app,'no_show','Cliente ausente tras la espera');
  assert.equal(result.statusCode,200,result.body);
  assert.equal(fixture.booking.cancellation_reason,'Cliente ausente tras la espera');
 }finally{await fixture.app.close();}
});
