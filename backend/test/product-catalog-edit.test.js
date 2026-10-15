import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerRoutes} from '../src/routes.js';
import {describeApiError} from '../src/app.js';
import {HttpProblem} from '../src/security.js';

const tenant='11111111-1111-4111-8111-111111111111';
const productId='22222222-2222-4222-8222-222222222222';
const actor='33333333-3333-4333-8333-333333333333';

async function setup(){
 const app=Fastify({logger:false});
 let role='owner';
 const events=[];
 const product={id:productId,tenant_id:tenant,name:'Gel profesional',sku:'GEL-1',
  stock:10,is_active:true,waiting_room_visible:true,price_minor:15000,cost_minor:9000};
 const db={
  query:async(sql,args=[])=>{
   events.push({sql,args});
   if(sql.includes('UPDATE public.products SET name=')){
    assert.equal(args.length,10);
    if(!product.is_active)return {rowCount:0,rows:[]};
    Object.assign(product,{name:args[2],sku:args[3],price_minor:args[4],description:args[5],
     photo_url:args[6],category:args[7],cost_minor:args[8],min_stock:args[9]});
    return {rowCount:1,rows:[{...product}]};
   }
   if(sql.includes('SET is_active=false')){
    if(!product.is_active)return {rowCount:0,rows:[]};
    product.is_active=false;product.waiting_room_visible=false;
    return {rowCount:1,rows:[{id:productId}]};
   }
   if(sql.includes('SET is_active=true')){
    if(product.is_active)return {rowCount:0,rows:[]};
    product.is_active=true;
    return {rowCount:1,rows:[{...product}]};
   }
   throw Error('Unexpected SQL '+sql);
  }
 };
 const security={
  authenticated:async req=>{req.actor={id:actor,email:'owner@example.com'};},
  limited:async()=>{},
  requireTenant:async(_db,tenantId,_actor,allowed)=>{
   if(tenantId!==tenant||!allowed?.includes(role))throw new HttpProblem(403,'Acceso denegado');
   return role;
  }
 };
 app.setErrorHandler((err,req,reply)=>{
  const {status,message}=describeApiError(err);
  reply.code(status).send({error:message});
 });
 await registerRoutes(app,{db,security,config:{}});
 await app.ready();
 return {app,product,events,setRole:r=>{role=r;}};
}

const url='/api/v1/tenants/'+tenant+'/products/'+productId;
const payload={name:'Gel profesional premium',sku:'GEL-1',priceMinor:24000,
 description:'Tratamiento de acabado',photoUrl:'',category:'beauty',costMinor:11000,minStock:2};

test('only owner edits product fields, never inventory stock',async()=>{
 const f=await setup();
 try{
  f.setRole('barber');
  const forbidden=await f.app.inject({method:'PATCH',url,payload});
  assert.equal(forbidden.statusCode,403,forbidden.body);
  f.setRole('owner');
  const bad=await f.app.inject({method:'PATCH',url,payload:{...payload,stock:900}});
  assert.equal(bad.statusCode,400,bad.body);
  const updated=await f.app.inject({method:'PATCH',url,payload});
  assert.equal(updated.statusCode,200,updated.body);
  assert.equal(updated.json().name,payload.name);
  assert.equal(updated.json().stock,10,'Stock is modified only via audited movements');
  assert.ok(!f.events.some(x=>/DELETE FROM public.products|UPDATE public.inventory_movements/.test(x.sql)));
 }finally{await f.app.close();}
});

test('archive hides product but keeps order and stock history; restore works',async()=>{
 const f=await setup();
 try{
  const response=await f.app.inject({method:'DELETE',url});
  assert.equal(response.statusCode,200,response.body);
  assert.equal(response.json().archived,true);
  assert.equal(f.product.is_active,false);
  assert.equal(f.product.waiting_room_visible,false);
  assert.equal(f.product.stock,10);
  assert.ok(f.events.every(x=>!x.sql.includes('DELETE FROM')));
  const again=await f.app.inject({method:'DELETE',url});
  assert.equal(again.statusCode,404,again.body);
  const restored=await f.app.inject({method:'PATCH',url:url+'/restore'});
  assert.equal(restored.statusCode,200,restored.body);
  assert.equal(restored.json().is_active,true);
  assert.equal(restored.json().waiting_room_visible,false,'Owner must re-enable waiting room visibility intentionally');
 }finally{await f.app.close();}
});
