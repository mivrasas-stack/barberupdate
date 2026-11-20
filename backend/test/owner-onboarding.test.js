import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerOwnerOnboardingRoutes} from '../src/owner-onboarding.js';

const ACTOR='11111111-1111-4111-8111-111111111111';
const form={ownerName:'Camila Dueña',phone:'+573001234567',
  shopName:'Barbería Central',city:'Bogotá',address:'Calle 10 # 20-30'};

async function fixture({authenticated=true}={}){
 const shops=[],members=[];
 const db={
  async transaction(run){return run(this);},
  async query(sql,args=[]){
   if(sql.includes('pg_advisory_xact_lock'))return {rows:[],rowCount:1};
   if(sql.includes('SELECT * FROM public.tenants WHERE owner_user_id')){
     const items=shops.filter(t=>t.owner_user_id===args[0]);
     return {rowCount:items.length,rows:items};
   }
   if(sql.includes('INSERT INTO public.tenants(')){
     const row={id:'22222222-2222-4222-8222-222222222222',slug:args[1],
       name:args[0],owner_user_id:args[2],business_kind:'barbershop'};
     shops.push(row);return {rowCount:1,rows:[row]};
   }
   if(sql.includes('INSERT INTO public.tenant_members(')){
     const existing=members.find(m=>m.tenant_id===args[0]&&m.user_id===args[1]);
     if(existing)existing.role='owner';
     else members.push({tenant_id:args[0],user_id:args[1],role:'owner'});
     return {rowCount:1,rows:[]};
   }
   throw Error('Unexpected SQL: '+sql);
  }
 };
 const app=Fastify();
 const security={
   authenticated:async req=>{if(!authenticated)throw Object.assign(Error('Token requerido'),{statusCode:401});req.actor={id:ACTOR,email:'camila@example.com'};},
   limited:async()=>{}
 };
 await registerOwnerOnboardingRoutes(app,{db,security});
 return {app,shops,members};
}
test('register creates one barbershop with owner membership and no barber employee',async()=>{
 const {app,shops,members}=await fixture();
 try{
  const first=await app.inject({method:'POST',url:'/api/v1/owner-onboarding',payload:form});
  assert.equal(first.statusCode,201,first.body);
  const data=first.json();
  assert.equal(data.created,true);
  assert.equal(data.role,'owner');
  assert.match(data.slug,/^barberia-central-[a-f0-9-]+$/);
  assert.equal(shops[0].owner_user_id,ACTOR);
  assert.equal(shops[0].business_kind,'barbershop');
  assert.deepEqual(members,[{tenant_id:data.tenantId,user_id:ACTOR,role:'owner'}]);
  const repeat=await app.inject({method:'POST',url:'/api/v1/owner-onboarding',payload:{...form,shopName:'Other Shop'}});
  assert.equal(repeat.statusCode,200,repeat.body);
  assert.equal(repeat.json().created,false);
  assert.equal(repeat.json().slug,data.slug);
  assert.equal(shops.length,1);
  assert.equal(members.length,1);
 }finally{await app.close();}
});
test('anonymous users and malformed data cannot create owner spaces',async()=>{
 const noAuth=await fixture({authenticated:false});
 try{
  const denied=await noAuth.app.inject({method:'POST',url:'/api/v1/owner-onboarding',payload:form});
  assert.equal(denied.statusCode,401,denied.body);
  assert.equal(noAuth.shops.length,0);
 }finally{await noAuth.app.close();}
 const fx=await fixture();
 try{
  const invalid=await fx.app.inject({method:'POST',url:'/api/v1/owner-onboarding',
    payload:{...form,userId:'arbitrary',role:'superadmin'}});
  assert.equal(invalid.statusCode,400,invalid.body);
  assert.equal(fx.shops.length,0);
 }finally{await fx.app.close();}
});