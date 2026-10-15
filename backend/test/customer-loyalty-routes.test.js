import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {HttpProblem} from '../src/security.js';
import {registerBusinessRoutes} from '../src/business.js';

const tenant='11111111-1111-4111-8111-111111111111';
const reward='22222222-2222-4222-8222-222222222222';
const customer='33333333-3333-4333-8333-333333333333';
const appointment='44444444-4444-4444-8444-444444444444';

async function setup(initialRole='owner'){
 const app=Fastify();
 let role=initialRole;
 const calls=[];
 const query=async(sql,args=[])=>{
  calls.push({sql,args});
  if(sql.includes('INSERT INTO public.loyalty_rewards'))
   return {rowCount:1,rows:[{id:reward,tenant_id:tenant,title:args[1],points_cost:args[3],is_active:true}]};
  if(sql.includes("FROM public.loyalty_rewards r JOIN public.tenants t ON t.id=r.tenant_id"))
   return {rowCount:1,rows:[{id:reward,points_cost:100}]};
  if(sql.includes('UPDATE public.loyalty_accounts SET points=points-$3'))
   return {rowCount:0,rows:[]}; // customer has no points; must not get a negative balance.
  if(sql.includes('FROM public.appointments WHERE tenant_id=$1'))
   return {rowCount:0,rows:[]}; // no completed, customer-owned booking
  return {rowCount:0,rows:[]};
 };
 const db={query,transaction:async fn=>fn({query})};
 const security={
  authenticated:async req=>{req.actor={id:customer,email:'test@example.com'};},
  limited:async()=>{},
  requireTenant:async(_db,id,_user,roles)=>{
   if(id!==tenant||!roles?.includes(role))throw new HttpProblem(403,'Permisos insuficientes');
   return role;
  }
 };
 await registerBusinessRoutes(app,{db,security});
 await app.ready();
 return {app,calls,setRole:value=>{role=value;}};
}

test('loyalty balances never fabricate the 420-point demo value',async()=>{
 const {app}=await setup();
 try{
  const response=await app.inject({method:'GET',url:'/api/v1/me/loyalty'});
  assert.equal(response.statusCode,200,response.body);
  assert.deepEqual(response.json(),[]);
 }finally{await app.close();}
});

test('only a barberia owner can publish rewards',async()=>{
 const {app,setRole}=await setup('barber');
 try{
  const url='/api/v1/tenants/'+tenant+'/rewards';
  const payload={title:'Corte de cortesía',description:'',pointsCost:100,isActive:true};
  const denied=await app.inject({method:'POST',url,payload});
  assert.equal(denied.statusCode,403,denied.body);
  setRole('owner');
  const accepted=await app.inject({method:'POST',url,payload});
  assert.equal(accepted.statusCode,201,accepted.body);
  assert.equal(accepted.json().points_cost,100);
 }finally{await app.close();}
});

test('redemption requires idempotency key and enough tenant points',async()=>{
 const {app,calls}=await setup();
 try{
  const url='/api/v1/tenants/'+tenant+'/redeem';
  const payload={rewardId:reward};
  const noKey=await app.inject({method:'POST',url,payload});
  assert.equal(noKey.statusCode,400,noKey.body);
  const denied=await app.inject({method:'POST',url,payload,headers:{'idempotency-key':'reward-test-key-12345'}});
  assert.equal(denied.statusCode,409,denied.body);
  assert.ok(calls.some(c=>c.sql.includes('UPDATE public.loyalty_accounts SET points=points-$3')));
  assert.equal(calls.filter(c=>c.sql.includes('INSERT INTO public.loyalty_redemptions')).length,0,'No canje sin saldo');
 }finally{await app.close();}
});

test('reviews cannot be submitted without a completed customer booking',async()=>{
 const {app}=await setup();
 try{
  const denied=await app.inject({method:'POST',url:'/api/v1/tenants/'+tenant+'/reviews',
   payload:{appointmentId:appointment,rating:5,comment:'Buen servicio'}});
  assert.equal(denied.statusCode,403,denied.body);
 }finally{await app.close();}
});
