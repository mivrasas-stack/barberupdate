import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerRoutes} from '../src/routes.js';
import {describeApiError} from '../src/app.js';
import {HttpProblem} from '../src/security.js';

const TENANT='11111111-1111-4111-8111-111111111111';
const ACTOR='22222222-2222-4222-8222-222222222222';
function fixture(){
 const rows=[];
 let closed=false;
 const db={
   query:async(sql,args)=>{
     if(sql.startsWith('SELECT * FROM public.transactions WHERE tenant_id'))
       return {rows:rows.filter(r=>r.tenant_id===args[0]),rowCount:rows.length};
     throw Error('Unexpected query: '+sql);
   },
   transaction:async fn=>fn({query:async(sql,args)=>{
     if(sql.includes('AS local_day'))return {rowCount:1,rows:[{local_day:'2026-10-15'}]};
     if(sql.includes('pg_advisory_xact_lock'))return {rowCount:1,rows:[{}]};
     if(sql.includes('INSERT INTO public.transactions')){
       if(closed)throw Object.assign(new Error('This business day has already been closed'),{code:'23514'});
       assert.equal(args.length,8,'Notes must be persisted as the 8th parameter');
       const row={id:String(rows.length+1),tenant_id:args[0],type:args[1],category:args[2],
         concept:args[3],amount_minor:args[4],payment_method:args[5],
         created_by:args[6],notes:args[7],created_at:'2026-10-15T01:00:00Z'};
       rows.push(row);
       return {rowCount:1,rows:[row]};
     }
     throw Error('Unexpected transaction SQL '+sql);
   }})
 };
 const security={
   authenticated:async req=>{req.actor={id:req.headers['x-test-user']==='outsider'?'outsider':ACTOR};},
   limited:async()=>{},
   requireTenant:async(_db,tenant,user)=>{
     if(tenant!==TENANT||user!==ACTOR)throw new HttpProblem(403,'Sin acceso');
     return 'owner';
   },
   service:null
 };
 const app=Fastify({logger:false});
 app.setErrorHandler((err,req,reply)=>{
   const {status,message}=describeApiError(err);
   reply.code(status).send({error:message,requestId:req.id});
 });
 return {app,db,security,rows,setClosed:value=>{closed=value;}};
}

test('expense notes persist, reload, validate and obey closed-cash-day rules',async()=>{
 const f=fixture();
 await registerRoutes(f.app,{config:{},db:f.db,security:f.security});
 await f.app.ready();
 const url='/api/v1/tenants/'+TENANT+'/transactions';
 const expense={type:'expense',category:'other',concept:'Toallas',amountMinor:120000,
   paymentMethod:'transfer',notes:'Factura de proveedor #123'};
 try{
   const created=await f.app.inject({method:'POST',url,payload:expense});
   assert.equal(created.statusCode,201,created.body);
   assert.equal(created.json().notes,expense.notes);
   const reload=await f.app.inject({method:'GET',url});
   assert.equal(reload.statusCode,200,reload.body);
   assert.equal(reload.json()[0].notes,expense.notes);
   const tooLong=await f.app.inject({method:'POST',url,payload:{...expense,notes:'x'.repeat(1001)}});
   assert.equal(tooLong.statusCode,400,tooLong.body);
   const outsider=await f.app.inject({method:'POST',url,headers:{'x-test-user':'outsider'},payload:expense});
   assert.equal(outsider.statusCode,403,outsider.body);
   f.setClosed(true);
   const late=await f.app.inject({method:'POST',url,payload:expense});
   assert.equal(late.statusCode,409,late.body);
   assert.match(late.json().error,/cierre de caja/i);
   assert.equal(f.rows.length,1,'Failed attempts must not create accounting entries');
 } finally{await f.app.close();}
});

test('old clients can omit notes while new schema stores the empty default',async()=>{
 const f=fixture();
 await registerRoutes(f.app,{config:{},db:f.db,security:f.security});
 await f.app.ready();
 try{
  const result=await f.app.inject({method:'POST',url:'/api/v1/tenants/'+TENANT+'/transactions',
   payload:{type:'income',category:'services',concept:'Servicio',amountMinor:25000,paymentMethod:'cash'}});
  assert.equal(result.statusCode,201,result.body);
  assert.equal(result.json().notes,'');
 }finally{await f.app.close();}
});


test('owner records manual additional income and operational expense as separate typed ledger entries',async()=>{
 const f=fixture();
 await registerRoutes(f.app,{config:{},db:f.db,security:f.security});
 await f.app.ready();
 const url='/api/v1/tenants/'+TENANT+'/transactions';
 try{
  const income=await f.app.inject({method:'POST',url,payload:{
   type:'income',category:'other',concept:'Ingreso extraordinario',
   amountMinor:47000,paymentMethod:'nequi',notes:'Comprobante externo verificado'
  }});
  assert.equal(income.statusCode,201,income.body);
  const expense=await f.app.inject({method:'POST',url,payload:{
   type:'expense',category:'utilities',concept:'Factura de luz',
   amountMinor:23500,paymentMethod:'transfer',notes:'Factura corriente'
  }});
  assert.equal(expense.statusCode,201,expense.body);
  assert.equal(f.rows.length,2);
  assert.equal(f.rows[0].type,'income');
  assert.equal(f.rows[0].amount_minor,47000);
  assert.equal(f.rows[1].type,'expense');
  assert.equal(f.rows[1].amount_minor,23500);
  const listed=await f.app.inject({method:'GET',url});
  assert.equal(listed.statusCode,200,listed.body);
  assert.equal(listed.json().filter(x=>x.type==='income').length,1);
  assert.equal(listed.json().filter(x=>x.type==='expense').length,1);
 }finally{await f.app.close();}
});
