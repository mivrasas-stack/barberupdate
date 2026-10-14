import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {validateClosureDate,registerClosureRoutes} from '../src/closures.js';

const tenant='11111111-1111-4111-8111-111111111111';
const date=new Date(Date.now()+20*86400000).toISOString().slice(0,10);
async function fixture(){
 const rows=[];
 const db={query:async(sql,args)=>{
   if(sql.startsWith('INSERT INTO public.tenant_closed_days')){
     const r={closed_date:args[1],reason:args[2],created_at:new Date().toISOString()};
     rows.push(r);return {rows:[r],rowCount:1};
   }
   if(sql.startsWith('SELECT closed_date')){
     const valid=rows.filter(r=>r.closed_date>=args[1]&&r.closed_date<=args[2]);
     return {rows:valid,rowCount:valid.length};
   }
   if(sql.startsWith('DELETE FROM public.tenant_closed_days')){
     const index=rows.findIndex(r=>r.closed_date===args[1]);
     if(index<0)return {rows:[],rowCount:0};
     return {rows:rows.splice(index,1),rowCount:1};
   }
   throw Error('Unexpected query '+sql);
 }};
 const security={
   authenticated:async req=>{req.actor={id:req.headers['x-test-actor']||'owner'};},
   limited:async()=>{},
   requireTenant:async(_db,_tid,user,roles)=>{
     const role=user==='barber'?'barber':user==='manager'?'manager':
       user==='owner'?'owner':null;
     if(!role||roles&&!roles.includes(role)){
       const err=new Error('No autorizado');err.statusCode=403;throw err;
     }
     return role;
   }
 };
 const app=Fastify({logger:false});
 await registerClosureRoutes(app,{db,security});
 await app.ready();
 return {app,rows};
}
test('Closure date validation rejects past and excessive future dates',()=>{
 assert.equal(validateClosureDate(date),date);
 assert.throws(()=>validateClosureDate('2020-01-01'));
 assert.throws(()=>validateClosureDate('2036-01-01'));
});
test('Tenant owner may close, read and reopen a date; barber read-only',async()=>{
 const {app,rows}=await fixture();
 const url='/api/v1/tenants/'+tenant+'/closed-days';
 try {
   const added=await app.inject({method:'POST',url,payload:{date,reason:'Holiday'}});
   assert.equal(added.statusCode,201,added.payload);
   assert.equal(rows.length,1);
   const read=await app.inject({method:'GET',url:url+'?from='+date+'&to='+date,
     headers:{'x-test-actor':'barber'}});
   assert.equal(read.statusCode,200,read.payload);
   assert.equal(read.json().length,1);
   const denied=await app.inject({method:'POST',url,headers:{'x-test-actor':'barber'},
     payload:{date,reason:'Not allowed'}});
   assert.equal(denied.statusCode,403,denied.payload);
   const outsider=await app.inject({method:'GET',url:url+'?from='+date+'&to='+date,
     headers:{'x-test-actor':'outsider'}});
   assert.equal(outsider.statusCode,403,outsider.payload);
   const removed=await app.inject({method:'DELETE',url:url+'/'+date});
   assert.equal(removed.statusCode,200,removed.payload);
   assert.equal(rows.length,0);
 }finally{await app.close();}
});
test('Closure API rejects ranges above one year',async()=>{
 const {app}=await fixture();
 try{
   const result=await app.inject({method:'GET',
     url:'/api/v1/tenants/'+tenant+'/closed-days?from=2026-01-01&to=2028-01-01'});
   assert.equal(result.statusCode,400);
 }finally{await app.close();}
});
