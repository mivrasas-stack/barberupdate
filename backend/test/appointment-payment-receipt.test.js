import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerRoutes} from '../src/routes.js';
import {describeApiError} from '../src/app.js';
import {HttpProblem} from '../src/security.js';

const tenant='11111111-1111-4111-8111-111111111111';
const apt='22222222-2222-4222-8222-222222222222';
const currentUser='33333333-3333-4333-8333-333333333333';
const barberUser='44444444-4444-4444-8444-444444444444';
const route='/api/v1/tenants/'+tenant+'/appointments/'+apt;

async function setup({role='owner',status='in_service',price=25000,failInsert=false}={}){
 const app=Fastify({logger:false});
 const appointment={
  id:apt,tenant_id:tenant,barber_id:'55555555-5555-4555-8555-555555555555',
  barber_user_id:barberUser,service_name:'Corte clásico',
  customer_name:'Cliente de prueba',price_minor:price,status,
  starts_at:'2026-10-15T15:00:00Z',updated_at:'2026-10-15T16:00:00Z'
 };
 const transactions=[];
 const sqlLog=[];
 const db={
  transaction:async fn=>{
   const snapshot={status:appointment.status,entries:transactions.map(e=>({...e}))};
   try{return await fn(db);}catch(error){
    appointment.status=snapshot.status;
    transactions.splice(0,transactions.length,...snapshot.entries);
    throw error;
   }
  },
  query:async(sql,args=[])=>{
   sqlLog.push({sql,args});
   if(sql.includes('FROM public.appointments a JOIN public.barbers b')&&sql.includes('FOR UPDATE OF a'))
    return {rowCount:1,rows:[{...appointment}]};
   if(sql.includes('FROM public.appointments a JOIN public.barbers b')&&sql.includes('JOIN public.tenants t'))
    return {rowCount:1,rows:[{...appointment,currency:'COP'}]};
   if(sql.includes('SELECT * FROM public.transactions WHERE tenant_id='))
    return {rowCount:transactions.length,rows:transactions.map(x=>({...x}))};
   if(sql.includes('FROM public.tenants WHERE id=')&&sql.includes('local_day'))
    return {rowCount:1,rows:[{local_day:'2026-10-15',currency:'COP'}]};
   if(sql.includes('SELECT currency FROM public.tenants WHERE id='))
    return {rowCount:1,rows:[{currency:'COP'}]};
   if(sql.includes('pg_advisory_xact_lock'))return {rowCount:1,rows:[{}]};
   if(sql.includes('INSERT INTO public.transactions')){
    if(failInsert)throw new HttpProblem(409,'Dia contable cerrado');
    const row={id:'66666666-6666-4666-8666-666666666666',tenant_id:tenant,
      type:'income',category:'haircut_service',concept:args[1],amount_minor:args[2],
      payment_method:args[3],reference_id:args[4],created_by:args[5],notes:args[6],
      created_at:'2026-10-15T16:00:00Z'};
    transactions.push(row);
    return {rowCount:1,rows:[row]};
   }
   if(sql.includes('UPDATE public.appointments SET status=')){
    appointment.status='completed';
    return {rowCount:1,rows:[{...appointment}]};
   }
   throw Error('Unexpected SQL: '+sql);
  }
 };
 const security={
  authenticated:async req=>{req.actor={id:currentUser,email:'worker@example.com'};},
  limited:async()=>{},
  requireTenant:async(_db,id,actor,accepted)=>{
   if(id!==tenant||actor!==currentUser||!accepted.includes(role))throw new HttpProblem(403,'Sin acceso');
   return role;
  }
 };
 app.setErrorHandler((err,req,reply)=>{
  const {status:code,message}=describeApiError(err);
  reply.code(code).send({error:message});
 });
 await registerRoutes(app,{config:{},db,security});
 await app.ready();
 return {app,appointment,transactions,sqlLog};
}
const settle=(app,method='nequi')=>app.inject({
 method:'POST',url:route+'/finish-and-pay',payload:{method,confirmReceived:true}
});

test('service settlement creates one linked accounting income and a durable receipt',async()=>{
 const f=await setup();
 try{
  const first=await settle(f.app);
  assert.equal(first.statusCode,200,first.body);
  assert.equal(first.json().transactionId,'66666666-6666-4666-8666-666666666666');
  assert.equal(first.json().paymentMethod,'nequi');
  assert.equal(first.json().totalMinor,25000);
  assert.equal(f.appointment.status,'completed');
  assert.equal(f.transactions.length,1);
  assert.equal(f.transactions[0].reference_id,apt);
  assert.equal(f.transactions[0].category,'haircut_service');
  assert.equal(f.transactions[0].amount_minor,25000);
  assert.ok(f.sqlLog.some(x=>x.sql.includes('pg_advisory_xact_lock')),'Serialize with daily cash close');
  const twice=await settle(f.app);
  assert.equal(twice.statusCode,200,twice.body);
  assert.equal(f.transactions.length,1,'No double income on retry');
  assert.equal((await settle(f.app,'cash')).statusCode,409,'Cannot replace accounting method on replay');
  const reload=await f.app.inject({method:'GET',url:route+'/payment-receipt'});
  assert.equal(reload.statusCode,200,reload.body);
  assert.equal(reload.json().transactionId,first.json().transactionId);
  assert.match(reload.json().verification,/manual|personal autorizado|presencial/i);
 }finally{await f.app.close();}
});
test('closed cash day rolls back transaction and the appointment remains in service',async()=>{
 const f=await setup({failInsert:true});
 try{
  const result=await settle(f.app,'cash');
  assert.equal(result.statusCode,409,result.body);
  assert.equal(f.appointment.status,'in_service');
  assert.equal(f.transactions.length,0);
 }finally{await f.app.close();}
});
test('cannot charge before starting or charge for another barber',async()=>{
 const pending=await setup({status:'confirmed'});
 try{assert.equal((await settle(pending.app)).statusCode,409);assert.equal(pending.transactions.length,0);}
 finally{await pending.app.close();}
 const other=await setup({role:'barber'});
 try{assert.equal((await settle(other.app)).statusCode,403);assert.equal(other.transactions.length,0);
  assert.equal((await other.app.inject({method:'GET',url:route+'/payment-receipt'})).statusCode,403);
 }finally{await other.app.close();}
});
test('a zero-price courtesy is completed without inventing income',async()=>{
 const f=await setup({price:0});
 try{
  const res=await settle(f.app,'cash');
  assert.equal(res.statusCode,200,res.body);
  assert.equal(res.json().paymentMethod,'courtesy');
  assert.equal(res.json().totalMinor,0);
  assert.equal(res.json().transactionId,null);
  assert.equal(f.transactions.length,0);
  assert.equal(f.appointment.status,'completed');
 }finally{await f.app.close();}
});
test('explicit collected payment confirmation is required',async()=>{
 const f=await setup();
 try{
  const res=await f.app.inject({method:'POST',url:route+'/finish-and-pay',
   payload:{method:'nequi',confirmReceived:false}});
  assert.equal(res.statusCode,400,res.body);
  assert.equal(f.appointment.status,'in_service');
  assert.equal(f.transactions.length,0);
 }finally{await f.app.close();}
});
