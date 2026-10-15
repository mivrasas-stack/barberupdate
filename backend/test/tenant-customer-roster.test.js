import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerCustomerLinkRoutes} from '../src/customer-links.js';
import {HttpProblem} from '../src/security.js';

const tenant='11111111-1111-4111-8111-111111111111';
const foreign='22222222-2222-4222-8222-222222222222';
const user='33333333-3333-4333-8333-333333333333';
const customer='44444444-4444-4444-8444-444444444444';
const noBooking='55555555-5555-4555-8555-555555555555';
const path='/api/v1/tenants/'+tenant+'/customers';

async function setup(role='owner'){
 const app=Fastify({logger:false});
 const queries=[],lookups=[];
 let avatar='https://example.com/old-avatar.webp';
 let currentRole=role;
 const db={query:async(sql,args=[])=>{
  queries.push({sql,args});
  if(sql.includes('WITH customers AS')){
   assert.deepEqual(args,[tenant],'Tenant must come from authorized path');
   return {rows:[
    {user_id:customer,full_name:'Cliente QR',phone:'3001234567',linked_by_qr:true,
     linked_at:'2026-10-15T12:00:00Z',completed_visits:1,total_spent:25000,
     last_service:'Corte clásico',last_service_at:'2026-10-15T14:00:00Z',points:25},
    {user_id:noBooking,full_name:'Registrado sin cita',phone:'3000000000',linked_by_qr:true,
     linked_at:'2026-10-15T13:00:00Z',completed_visits:0,total_spent:0,
     last_service:null,last_service_at:null,points:0}
   ]};
  }
  return {rows:[],rowCount:0};
 }};
 const security={
  authenticated:async req=>{req.actor={id:user,email:'owner@example.com'};},
  limited:async()=>{},
  requireTenant:async(_db,id,actor,roles)=>{
   if(id!==tenant||actor!==user||!roles.includes(currentRole))throw new HttpProblem(403,'Sin permiso');
  },
  service:{auth:{admin:{
   getUserById:async id=>{
    lookups.push(id);
    return {data:{user:{email:id===customer?'client@example.com':'new@example.com',
      user_metadata:id===customer?{avatar_url:avatar,full_name:'Perfil real'}:{}}},error:null};
   }
  }}}
 };
 await registerCustomerLinkRoutes(app,{db,security});
 await app.ready();
 return {app,queries,lookups,setRole:x=>{currentRole=x;},setAvatar:x=>{avatar=x;}};
}

test('QR registrations appear with zero visits before ever booking a service',async()=>{
 const fixture=await setup();
 try{
  const result=await fixture.app.inject({method:'GET',url:path});
  assert.equal(result.statusCode,200,result.body);
  const rows=result.json();
  assert.equal(rows.length,2);
  assert.equal(rows[1].name,'Registrado sin cita');
  assert.equal(rows[1].visits,0);
  assert.equal(rows[1].lastService,null);
  assert.equal(rows[1].totalSpent,0);
  assert.equal(rows[0].linkedByQr,true);
  assert.equal(rows[0].email,'client@example.com');
  assert.equal(rows[0].avatar,'https://example.com/old-avatar.webp');
  assert.deepEqual(fixture.lookups,[customer,noBooking]);
  const sql=fixture.queries[0].sql;
  assert.match(sql,/FROM public.customer_links WHERE tenant_id=\$1/);
  assert.match(sql,/FROM public.appointments a/);
  assert.match(sql,/AND a.customer_user_id IS NOT NULL/);
  assert.match(sql,/status='completed'/);
  assert.match(sql,/NOT EXISTS/,'Bookers with QR must not be duplicated');
 }finally{await fixture.app.close();}
});

test('updated Supabase Auth avatar is returned after next refresh; no demo URL',async()=>{
 const fixture=await setup();
 try{
  const initial=await fixture.app.inject({method:'GET',url:path});
  assert.equal(initial.json()[0].avatar,'https://example.com/old-avatar.webp');
  fixture.setAvatar('https://example.com/new-avatar.webp');
  const updated=await fixture.app.inject({method:'GET',url:path});
  assert.equal(updated.json()[0].avatar,'https://example.com/new-avatar.webp');
 }finally{await fixture.app.close();}
});

test('tenant isolation and staff role enforced before looking up Auth profiles',async()=>{
 const fixture=await setup('client');
 try{
  const denied=await fixture.app.inject({method:'GET',url:path});
  assert.equal(denied.statusCode,403,denied.body);
  const wrong=await fixture.app.inject({method:'GET',url:'/api/v1/tenants/'+foreign+'/customers'});
  assert.equal(wrong.statusCode,403,wrong.body);
  assert.equal(fixture.lookups.length,0);
  assert.equal(fixture.queries.length,0);
  fixture.setRole('barber');
  const allowed=await fixture.app.inject({method:'GET',url:path});
  assert.equal(allowed.statusCode,200,allowed.body);
 }finally{await fixture.app.close();}
});
