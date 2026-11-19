import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerPlatformAdminRoutes} from '../src/platform-admin.js';

const admin='11111111-1111-4111-8111-111111111111';
const client='22222222-2222-4222-8222-222222222222';
const other='33333333-3333-4333-8333-333333333333';
const shop='44444444-4444-4444-8444-444444444444';
const date='2026-10-01T15:00:00.000Z';

function fixture({globalAdmin=true,protectedTarget=false}={}){
 const customer={id:client,email:'cliente@example.com',user_metadata:{full_name:'Cliente Real',phone:'3001234567'},
  app_metadata:{provider:'email'},email_confirmed_at:date,created_at:date,banned_until:null};
 const owner={id:other,email:'otro@example.com',user_metadata:{name:'Empleado'},app_metadata:{},
  email_confirmed_at:date,created_at:date};
 const updates=[],calls=[];
 const service={auth:{admin:{
  async listUsers(){return {data:{users:[customer,owner]},error:null};},
  async getUserById(userId){return {data:{user:userId===client?customer:userId===other?owner:null},error:null};},
  async updateUserById(userId,data){
   updates.push({userId,data});
   if(data.app_metadata){customer.app_metadata=data.app_metadata;customer.banned_until='2120-01-01';}
   return {data:{user:customer},error:null};
  }
 }}};
 const db={
  transaction:async fn=>fn(db),
  async query(sql,args=[]){
   calls.push({sql,args});
   if(sql.includes('FROM public.platform_admins WHERE user_id=$1')&&args[0]===admin)
    return {rowCount:globalAdmin?1:0,rows:globalAdmin?[{ok:true}]:[]};
   if(sql.includes('FROM public.tenant_members m JOIN public.tenants t'))
    return {rowCount:1,rows:[{user_id:other,tenant_id:shop,role:'barber',created_at:date,shop_name:'Barbería Central'}]};
   if(sql.includes('FROM public.customer_links l JOIN public.tenants t'))
    return {rowCount:1,rows:[{user_id:client,tenant_id:shop,linked_at:date,shop_name:'Barbería Central'}]};
   if(sql.includes("FROM public.tenants WHERE owner_user_id=$1 AND status='active' LIMIT 1"))
     return {rowCount:protectedTarget?1:0,rows:protectedTarget?[{name:'Barbería de prueba'}]:[]};
   if(sql.includes('FROM public.tenants WHERE owner_user_id=ANY'))return {rowCount:0,rows:[]};
   if(sql.includes('FROM public.platform_admins WHERE user_id=ANY'))return {rowCount:0,rows:[]};
   if(sql.includes('UPDATE public.whatsapp_consents SET revoked_at='))return {rowCount:1,rows:[]};
   if(sql.includes('UPDATE public.whatsapp_messages SET status='))return {rowCount:1,rows:[]};
   if(sql.includes('FROM public.platform_admins WHERE user_id=$1') ||
      sql.includes('UNION ALL SELECT 1 FROM public.tenants WHERE owner_user_id=')){
     return {rowCount:protectedTarget?1:0,rows:protectedTarget?[{ok:true}]:[]};
   }
   throw Error('Unexpected SQL '+sql);
  }
 };
 const security={
  authenticated:async req=>{req.actor={id:admin,email:'admin@example.com'};},
  limited:async()=>{},service
 };
 return {db,security,updates,calls,customer};
}
async function withApp(options,callback){
 const fixtureData=fixture(options),app=Fastify({logger:false});
 await registerPlatformAdminRoutes(app,{db:fixtureData.db,security:fixtureData.security});
 try{await callback(app,fixtureData);}finally{await app.close();}
}
test('superadmin directory returns all QR affiliations with link date and shop name',async()=>{
 await withApp({},async(app)=>{
  const res=await app.inject({method:'GET',url:'/api/v1/platform/users'});
  assert.equal(res.statusCode,200,res.body);
  const users=res.json();
  const entry=users.find(x=>x.id===client);
  assert.equal(entry.role,'client');
  assert.equal(entry.businessId,shop);
  assert.deepEqual(entry.barbershops,[{id:shop,name:'Barbería Central',linkedAt:date,relation:'client'}]);
  const staff=users.find(x=>x.id===other);
  assert.equal(staff.barbershops[0].relation,'barber');
 });
});
test('manual reset requires a validated password and superadmin session',async()=>{
 await withApp({},async(app,{updates})=>{
  const wrong=await app.inject({method:'POST',url:'/api/v1/platform/users/'+client+'/password',payload:{password:'12345'}});
  assert.equal(wrong.statusCode,400);
  assert.equal(updates.length,0);
  const ok=await app.inject({method:'POST',url:'/api/v1/platform/users/'+client+'/password',payload:{password:'abc123'}});
  assert.equal(ok.statusCode,200,ok.body);
  assert.equal(ok.json().ok,true);
  assert.deepEqual(updates[0],{userId:client,data:{password:'abc123'}});
  assert.equal(ok.body.includes('abc123'),false);
 });
 await withApp({globalAdmin:false},async(app,{updates})=>{
  const bad=await app.inject({method:'POST',url:'/api/v1/platform/users/'+client+'/password',payload:{password:'abc123'}});
  assert.equal(bad.statusCode,403);
  assert.equal(updates.length,0);
 });
});
test('delete requires explicit ELIMINAR, deactivates login, and user disappears on reload',async()=>{
 await withApp({},async(app,{updates})=>{
  for(const payload of [{}, {confirmation:'Sí'}, {confirmation:'eliminar'}]){
   const invalid=await app.inject({method:'DELETE',url:'/api/v1/platform/users/'+client,payload});
   assert.equal(invalid.statusCode,400);
  }
  assert.equal(updates.length,0);
  const deleted=await app.inject({method:'DELETE',url:'/api/v1/platform/users/'+client,payload:{confirmation:'ELIMINAR'}});
  assert.equal(deleted.statusCode,200,deleted.body);
  assert.equal(deleted.json().historyPreserved,true);
  assert.equal(updates.length,1);
  assert.equal(updates[0].userId,client);
  assert.equal(updates[0].data.app_metadata.provider,'email');
  assert.ok(updates[0].data.app_metadata.barbernow_deleted_at);
  assert.equal(updates[0].data.ban_duration,'876000h');
  const dir=await app.inject({method:'GET',url:'/api/v1/platform/users'});
  assert.equal(dir.statusCode,200);
  assert.ok(!dir.json().some(x=>x.id===client),'Removed client must not reappear');
  const again=await app.inject({method:'DELETE',url:'/api/v1/platform/users/'+client,payload:{confirmation:'ELIMINAR'}});
  assert.equal(again.statusCode,404);
 });
});
test('a superadmin can retire other test superadmins without removing their own account',async()=>{
 await withApp({},async(app,{updates})=>{
  const removed=await app.inject({method:'DELETE',url:'/api/v1/platform/users/'+other,
    payload:{confirmation:'ELIMINAR'}});
  assert.equal(removed.statusCode,200,removed.body);
  assert.equal(updates.length,1);
  assert.equal(updates[0].userId,other);
 });
});
test('the administrator cannot remove themselves or protected business owners',async()=>{
 await withApp({},async(app,{updates})=>{
  const self=await app.inject({method:'DELETE',url:'/api/v1/platform/users/'+admin,payload:{confirmation:'ELIMINAR'}});
  assert.equal(self.statusCode,403);
  assert.equal(updates.length,0);
 });
 await withApp({protectedTarget:true},async(app,{updates})=>{
  const protectedUser=await app.inject({method:'DELETE',url:'/api/v1/platform/users/'+client,payload:{confirmation:'ELIMINAR'}});
  assert.equal(protectedUser.statusCode,409);
  assert.equal(updates.length,0);
 });
});