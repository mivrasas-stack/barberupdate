import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerPaymentsRoutes} from '../src/payments.js';

const tenant='11111111-1111-4111-8111-111111111111';
const order='22222222-2222-4222-8222-222222222222';
const payment='33333333-3333-4333-8333-333333333333';
const api='/api/v1/tenants/'+tenant+'/payments/'+payment+'/refund-manual';

async function buildFixture(){
  const refunds=[];
  const entries=[];
  const faults={accountingFailure:false};
  const paymentRow={id:payment,tenant_id:tenant,order_id:order,
    status:'confirmed',amount_minor:'12500',currency:'COP',method:'transfer'};
  const query=async(sql,params=[])=>{
    if(sql.includes('SELECT pg_advisory_xact_lock'))return {rows:[],rowCount:1};
    if(sql.includes('SELECT * FROM public.manual_refunds WHERE tenant_id=$1 AND created_by')){
      const matches=refunds.filter(r=>r.tenant_id===params[0]&&
        r.created_by===params[1]&&r.idempotency_key===params[2]);
      return {rows:matches,rowCount:matches.length};
    }
    if(sql.includes('SELECT order_id FROM public.manual_payments'))
      return {rows:[{order_id:order}],rowCount:1};
    if(sql.includes('SELECT id,status FROM public.orders'))
      return {rows:[{id:order,status:'received'}],rowCount:1};
    if(sql.includes('SELECT * FROM public.manual_payments'))
      return {rows:[paymentRow],rowCount:1};
    if(sql.includes('SELECT coalesce(sum(amount_minor),0)::bigint AS refunded'))
      return {rows:[{refunded:String(refunds.reduce((n,x)=>n+Number(x.amount_minor),0))}],rowCount:1};
    if(sql.includes('SELECT (now() AT TIME ZONE time_zone)'))
      return {rows:[{local_day:'2026-10-13'}],rowCount:1};
    if(sql.includes('INSERT INTO public.manual_refunds')){
      const r={id:'44444444-4444-4444-8444-'+String(refunds.length+1).padStart(12,'0'),
        tenant_id:params[0],payment_id:params[1],order_id:params[2],
        amount_minor:params[3],currency:params[4],method:params[5],
        reason:params[6],reference:params[7],created_by:params[8],
        idempotency_key:params[9],request_hash:params[10],
        created_at:'2026-10-13T13:00:00Z'};
      refunds.push(r);
      return {rows:[r],rowCount:1};
    }
    if(sql.includes('INSERT INTO public.transactions')){
      if(faults.accountingFailure)throw new Error('Injected PostgreSQL transaction failure');
      entries.push({tenant_id:params[0],amount_minor:params[1],
        method:params[2],reference_id:params[3],created_by:params[4]});
      return {rows:[],rowCount:1};
    }
    if(sql.includes('SELECT 1 FROM public.tenant_members'))
      return {rows:[{exists:1}],rowCount:1};
    if(sql.includes('SELECT customer_user_id,total_minor FROM public.orders'))
      return {rows:[{customer_user_id:'owner',total_minor:'12500'}],rowCount:1};
    if(sql.includes('SELECT id,amount_minor,currency,method,status,reference,confirmed_at,created_at FROM public.manual_payments'))
      return {rows:[paymentRow],rowCount:1};
    if(sql.includes('SELECT id,payment_id,order_id,amount_minor,currency,method,reference,reason,created_at FROM public.manual_refunds'))
      return {rows:refunds,rowCount:refunds.length};
    throw new Error('Unmocked SQL: '+sql.slice(0,100));
  };
  // Simulates PostgreSQL transaction rollback when a later statement fails.
  const db={query,transaction:async fn=>{
    const beforeRefunds=refunds.length,beforeEntries=entries.length;
    try{return await fn({query});}
    catch(error){
      refunds.splice(beforeRefunds);entries.splice(beforeEntries);
      throw error;
    }
  }};
  const security={
    authenticated:async req=>{req.actor={id:req.headers['x-test-actor']||'owner'};},
    limited:async()=>{},
    requireTenant:async(_db,_tid,uid)=>{
      if(uid!=='owner') {const e=new Error('Sin acceso');e.statusCode=403;throw e;}
      return 'owner';
    }
  };
  const app=Fastify({logger:false});
  await registerPaymentsRoutes(app,{db,security});
  await app.ready();
  return {app,refunds,entries,faults};
}
const payload={amountMinor:5000,reason:'Customer returned part of the order',reference:'REF-TEST-12345'};
const headers={'idempotency-key':'refund-unit-123456','x-test-actor':'owner'};

test('Manual refund: immutable record, one expense and idempotent retry',async()=>{
  const x=await buildFixture();
  try{
    const first=await x.app.inject({method:'POST',url:api,headers,payload});
    assert.equal(first.statusCode,201,first.payload);
    assert.equal(x.refunds.length,1);
    assert.equal(x.entries.length,1);
    const retry=await x.app.inject({method:'POST',url:api,headers,payload});
    assert.equal(retry.statusCode,200,retry.payload);
    assert.equal(x.refunds.length,1,'No duplicate immutable refund');
    assert.equal(x.entries.length,1,'No duplicate cash expense');
    assert.equal(first.json().id,retry.json().id);
    const changed=await x.app.inject({
      method:'POST',url:api,headers,payload:{...payload,amountMinor:6000}
    });
    assert.equal(changed.statusCode,409);
    const summary=await x.app.inject({
      method:'GET',url:'/api/v1/tenants/'+tenant+'/orders/'+order+'/payments',headers
    });
    assert.equal(summary.statusCode,200,summary.payload);
    assert.equal(Number(summary.json().refundedMinor),5000);
    assert.equal(Number(summary.json().netReceivedMinor),7500);
  }finally{await x.app.close();}
});

test('Manual refund requires evidence and never exceeds confirmed amount',async()=>{
  const x=await buildFixture();
  try{
    const noReceipt=await x.app.inject({method:'POST',url:api,
      headers:{...headers,'idempotency-key':'refund-unit-absence-1234'},
      payload:{amountMinor:2000,reason:'Customer returned the order'}});
    assert.equal(noReceipt.statusCode,400,noReceipt.payload);
    const over=await x.app.inject({method:'POST',url:api,
      headers:{...headers,'idempotency-key':'refund-unit-overage-1234'},
      payload:{...payload,amountMinor:13000}});
    assert.equal(over.statusCode,409,over.payload);
    assert.equal(x.refunds.length,0);
    assert.equal(x.entries.length,0);
  }finally{await x.app.close();}
});

test('Manual refund is inaccessible to a different company owner',async()=>{
  const x=await buildFixture();
  try{
    const r=await x.app.inject({method:'POST',url:api,
      headers:{...headers,'x-test-actor':'outsider'},payload});
    assert.equal(r.statusCode,403,r.payload);
    assert.equal(x.refunds.length,0);
    assert.equal(x.entries.length,0);
  }finally{await x.app.close();}
});

test('Fault injection: failed accounting entry rolls back refund and allows retry',async()=>{
  const x=await buildFixture();
  try{
    x.faults.accountingFailure=true;
    const failed=await x.app.inject({method:'POST',url:api,headers,payload});
    assert.equal(failed.statusCode,500,'Injected failure must be visible, not false success');
    assert.equal(x.refunds.length,0,'Refund must roll back if ledger entry fails');
    assert.equal(x.entries.length,0,'No partial accounting entry');
    x.faults.accountingFailure=false;
    const retried=await x.app.inject({method:'POST',url:api,headers,payload});
    assert.equal(retried.statusCode,201,retried.payload);
    assert.equal(x.refunds.length,1);
    assert.equal(x.entries.length,1);
  }finally{await x.app.close();}
});
