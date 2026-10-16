import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { HttpProblem } from '../src/security.js';
import { registerPlatformAdminRoutes, createProfessionalProfile } from '../src/platform-admin.js';
import { registerRoutes } from '../src/routes.js';

const owner='11111111-1111-4111-8111-111111111111';
const shop='22222222-2222-4222-8222-222222222222';
const professional='33333333-3333-4333-8333-333333333333';

function fakeDb(admin=true) {
  const calls=[],barbers=[];
  const db={
    calls,barbers,
    async query(sql,args=[]) {
      calls.push({sql,args});
      if(sql.includes('FROM public.platform_admins WHERE user_id=$1'))return {rowCount:admin?1:0,rows:admin?[{}]:[]};
      if(sql.includes('FROM public.tenant_members WHERE user_id=ANY'))return {rowCount:0,rows:[]};
      if(sql.includes('FROM public.platform_admins WHERE user_id=ANY'))return {rowCount:0,rows:[]};
      if(sql.includes('SELECT id FROM public.tenants'))return {rowCount:1,rows:[{id:shop}]};
      if(sql.includes('SELECT * FROM public.barbers WHERE tenant_id=$1 AND user_id=$2')){
        const found=barbers.find(b=>b.tenant_id===args[0]&&b.user_id===args[1]);
        return {rowCount:found?1:0,rows:found?[found]:[]};
      }
      if(sql.includes('SELECT id FROM public.barbers WHERE tenant_id=$1 AND user_id=$2')){
        const found=barbers.find(b=>b.tenant_id===args[0]&&b.user_id===args[1]);
        return {rowCount:found?1:0,rows:found?[found]:[]};
      }
      if(sql.includes('INSERT INTO public.tenants')){
        return {rowCount:1,rows:[{id:shop,name:args[0],slug:args[1],owner_user_id:args[2]}]};
      }
      if(sql.includes('INSERT INTO public.barbers')){
        const row={id:professional,tenant_id:args[0],user_id:args[1],name:args[2],slug:args[3],status:'active'};
        barbers.push(row);
        return {rowCount:1,rows:[row]};
      }
      if(sql.includes('INSERT INTO public.barber_work_intervals')||sql.includes('INSERT INTO public.tenant_members')||sql.includes('pg_advisory_xact_lock'))return {rowCount:1,rows:[{}]};
      throw Error('Unexpected SQL: '+sql.slice(0,100));
    },
    async transaction(fn){return fn(this);}
  };
  return db;
}

const service={
  auth:{admin:{
    async listUsers(){return {data:{users:[]},error:null};},
    async inviteUserByEmail(email,{data}){return {data:{user:{id:owner,email,user_metadata:data}},error:null};},
    async getUserById(id){return {data:{user:{id,email:'owner@example.com',user_metadata:{name:'Propietaria Real'}}},error:null};},
  }}
};
const security=(admin=true)=>({
  authenticated:async req=>{req.actor={id:owner,email:'owner@example.com'};},
  limited:async()=>{},
  service,
  requireTenant:async(_db,_tenant,_user,roles)=>{
    if(roles&&!roles.includes('owner'))throw new HttpProblem(403,'Sin autorización');
    return 'owner';
  }
});
const ownerPayload={name:'Corte Centro',slug:'corte-centro',ownerUserId:owner,city:'Bogotá',address:'Carrera 7',ownerIsBarber:true};

test('platform creates cannot be called by non-superadmin, regardless of claimed role',async()=>{
  const app=Fastify(),db=fakeDb(false);
  await registerPlatformAdminRoutes(app,{db,security:security(false)});
  try{
    for(const [method,url,payload] of [
      ['GET','/api/v1/platform/users',undefined],
      ['POST','/api/v1/platform/users',{name:'Test',email:'test@example.com',role:'client'}],
      ['POST','/api/v1/platform/tenants',ownerPayload],
    ]){
      const res=await app.inject({method,url,payload});
      assert.equal(res.statusCode,403,res.body);
    }
    assert.equal(db.calls.some(x=>x.sql.includes('INSERT')),false);
  }finally{await app.close();}
});

test('superadmin creates a real shop and an independently bookable owner profile',async()=>{
  const app=Fastify(),db=fakeDb();
  await registerPlatformAdminRoutes(app,{db,security:security()});
  try{
    const res=await app.inject({method:'POST',url:'/api/v1/platform/tenants',payload:ownerPayload});
    assert.equal(res.statusCode,201,res.body);
    assert.equal(res.json().owner_user_id,owner);
    assert.equal(db.barbers.length,1);
    assert.equal(db.barbers[0].user_id,owner);
    assert.equal(db.calls.filter(c=>c.sql.includes('INSERT INTO public.barber_work_intervals')).length,6);
    assert.ok(db.calls.some(c=>c.sql.includes('INSERT INTO public.tenant_members')&&c.args[2]===undefined));
  }finally{await app.close();}
});

test('a new employee is invited with a barber role and schedule; no global admin role may be self-assigned',async()=>{
  const app=Fastify(),db=fakeDb();
  await registerPlatformAdminRoutes(app,{db,security:security()});
  try{
    const res=await app.inject({method:'POST',url:'/api/v1/platform/users',payload:{
      name:'Trabajador',email:'worker@example.com',phone:'3001234567',role:'barber_employee',tenantId:shop
    }});
    assert.equal(res.statusCode,201,res.body);
    assert.equal(db.barbers.length,1);
    assert.ok(db.calls.some(c=>c.sql.includes('INSERT INTO public.tenant_members')&&c.args[2]==='barber'));
    const invalid=await app.inject({method:'POST',url:'/api/v1/platform/users',payload:{
      name:'Another',email:'another@example.com',role:'superadmin'
    }});
    assert.equal(invalid.statusCode,400);
  }finally{await app.close();}
});

test('owner professional profile is idempotent and never changes the owner membership',async()=>{
  const db=fakeDb();
  const first=await db.transaction(tx=>createProfessionalProfile(tx,shop,owner,'Dueño','propietario'));
  const second=await db.transaction(tx=>createProfessionalProfile(tx,shop,owner,'Dueño','propietario'));
  assert.equal(first.id,second.id);
  assert.equal(db.barbers.length,1);
  assert.equal(db.calls.filter(c=>c.sql.includes('INSERT INTO public.barber_work_intervals')).length,6);
  assert.equal(db.calls.some(c=>c.sql.includes('UPDATE public.tenant_members')),false);
});
