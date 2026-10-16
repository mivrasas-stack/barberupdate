import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerBusinessRoutes} from '../src/business.js';
import {registerPaymentsRoutes} from '../src/payments.js';
import {HttpProblem} from '../src/security.js';

const TENANT='11111111-1111-4111-8111-111111111111';
const OTHER='99999999-9999-4999-8999-999999999999';
const ORDER='22222222-2222-4222-8222-222222222222';
const USER='33333333-3333-4333-8333-333333333333';
const LOOKUP='/api/v1/tenants/'+TENANT+'/orders/by-pickup-code?code=PK-A1B2C3D4';
const paymentUrl='/api/v1/tenants/'+TENANT+'/orders/'+ORDER+'/payments/manual';
const items=[
 {product_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',product_name:'Pomada',category:'beauty',quantity:1,unit_price_minor:12000,subtotal_minor:12000},
 {product_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',product_name:'Café',category:'food_drinks',quantity:2,unit_price_minor:4500,subtotal_minor:9000},
 {product_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',product_name:'Gorra',category:'barbershop_merch',quantity:1,unit_price_minor:24000,subtotal_minor:24000}
];

async function createFixture(){
 const payments=[],transactions=[],queries=[];
 const record={id:ORDER,pickup_code:'PK-A1B2C3D4',customer_name:'Cliente de prueba',status:'received',total_minor:45000,created_at:'2026-10-16T10:00:00Z'};
 const db={
  queries,payments,transactions,
  async query(sql,args=[]){
   queries.push({sql,args});
   if(sql.includes('SELECT id,pickup_code,customer_name,status,total_minor,created_at FROM public.orders'))
    return {rowCount:args[0]===TENANT&&args[1]===record.pickup_code?1:0,rows:args[0]===TENANT&&args[1]===record.pickup_code?[record]:[]};
   if(sql.includes('FROM public.order_items oi LEFT JOIN public.products p'))
    return {rowCount:3,rows:items};
   if(sql.includes('AS confirmed')&&sql.includes('AS refunded'))
    return {rowCount:1,rows:[{confirmed:payments.filter(p=>p.status==='confirmed').reduce((s,p)=>s+p.amount_minor,0),refunded:0}]};
   if(sql.includes('FROM public.manual_refunds WHERE tenant_id'))
    return {rowCount:1,rows:[{refunded:0}]};
   if(sql.includes('SELECT id,amount_minor,method,status,created_at FROM public.manual_payments'))
    return {rowCount:payments.length,rows:payments.filter(p=>p.status==='pending'||p.status==='confirmed')};
   if(sql.includes('FROM public.manual_payments WHERE tenant_id=$1 AND created_by=$2 AND idempotency_key=$3')){
    const match=payments.filter(p=>p.idempotency_key===args[2]&&p.created_by===args[1]);
    return {rowCount:match.length,rows:match};
   }
   if(sql.includes('SELECT o.id,o.total_minor,o.status,t.currency FROM public.orders'))
    return {rowCount:1,rows:[{id:ORDER,total_minor:45000,status:record.status,currency:'COP'}]};
   if(sql.includes("status IN ('pending','confirmed')"))
    return {rowCount:1,rows:[{amount:payments.filter(p=>p.status==='pending'||p.status==='confirmed').reduce((sum,p)=>sum+p.amount_minor,0)}]};
   if(sql.includes('INSERT INTO public.manual_payments')){
    const p={id:'44444444-4444-4444-8444-444444444444',order_id:ORDER,amount_minor:args[2],currency:'COP',method:args[4],
      idempotency_key:args[5],request_hash:args[6],created_by:args[7],status:'pending',created_at:'2026-10-16T10:00:00Z'};
    payments.push(p);return {rowCount:1,rows:[p]};
   }
   if(sql.includes('SELECT order_id FROM public.manual_payments'))
    return {rowCount:payments.length,rows:payments.map(p=>({order_id:p.order_id}))};
   if(sql.includes('SELECT id,total_minor,status FROM public.orders WHERE id=$1 AND tenant_id=$2 FOR UPDATE'))
    return {rowCount:1,rows:[{id:ORDER,total_minor:record.total_minor,status:record.status}]};
   if(sql.includes("UPDATE public.orders SET status='delivered'")){
    record.status='delivered';return {rowCount:1,rows:[{id:ORDER,status:'delivered',total_minor:record.total_minor,pickup_code:record.pickup_code}]};
   }
   if(sql.includes('SELECT id,status FROM public.orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE'))
    return {rowCount:1,rows:[{id:ORDER,status:record.status}]};
   if(sql.includes('SELECT * FROM public.manual_payments WHERE tenant_id=$1 AND id=$2 FOR UPDATE'))
    return {rowCount:payments.length,rows:payments};
   if(sql.includes('SELECT (now() AT TIME ZONE time_zone)::date::text AS day'))
    return {rowCount:1,rows:[{day:'2026-10-16'}]};
   if(sql.includes('pg_advisory_xact_lock'))
    return {rowCount:1,rows:[{}]};
   if(sql.includes("status='confirmed'")&&sql.includes('sum(amount_minor)'))
    return {rowCount:1,rows:[{amount:payments.filter(p=>p.status==='confirmed').reduce((sum,p)=>sum+p.amount_minor,0)}]};
   if(sql.includes('SELECT total_minor FROM public.orders WHERE id='))
    return {rowCount:1,rows:[{total_minor:record.total_minor}]};
   if(sql.includes("UPDATE public.manual_payments SET status='confirmed'")){
    const p=payments.find(p=>p.id===args[1]);
    p.status='confirmed';p.reference=args[2];p.confirmed_by=args[3];p.confirmed_at='2026-10-16T10:00:00Z';
    return {rowCount:1,rows:[p]};
   }
   if(sql.includes('INSERT INTO public.transactions')){
    transactions.push({tenant:args[0],amount:args[1],method:args[2],paymentId:args[3],user:args[4]});
    return {rowCount:1,rows:[transactions.at(-1)]};
   }
   throw Error('Unexpected SQL: '+sql.slice(0,145));
  },
  async transaction(fn){return fn(this);}
 };
 const app=Fastify();
 const security={
  authenticated:async req=>{req.actor={id:req.headers['x-test-user']==='outsider'?'outsider':USER};},
  limited:async()=>{},
  requireTenant:async(_db,tenant,user,roles)=>{
   if(tenant!==TENANT||user!==USER||!roles.some(r=>['owner','manager'].includes(r)))throw new HttpProblem(403,'Sin permiso');
   return 'owner';
  }
 };
 await registerBusinessRoutes(app,{db,security});
 await registerPaymentsRoutes(app,{db,security});
 await app.ready();
 return {app,db};
}

test('pickup lookup includes beauty, food and merch with authoritative tenant-scoped prices',async()=>{
 const {app,db}=await createFixture();
 try{
  const found=await app.inject({method:'GET',url:LOOKUP});
  assert.equal(found.statusCode,200,found.body);
  const result=found.json();
  assert.equal(result.totalMinor,45000);
  assert.equal(result.balanceMinor,45000);
  assert.deepEqual(result.items.map(x=>x.category),['beauty','food_drinks','barbershop_merch']);
  assert.equal(result.items.reduce((s,x)=>s+x.subtotalMinor,0),45000);
  assert.ok(db.queries.some(q=>q.sql.includes('pickup_code=$2')&&q.args[0]===TENANT));
  const foreign=await app.inject({method:'GET',url:'/api/v1/tenants/'+OTHER+'/orders/by-pickup-code?code=PK-A1B2C3D4'});
  assert.equal(foreign.statusCode,403);
  const outsider=await app.inject({method:'GET',url:LOOKUP,headers:{'x-test-user':'outsider'}});
  assert.equal(outsider.statusCode,403);
  const unknown=await app.inject({method:'GET',url:LOOKUP.replace('PK-A1B2C3D4','PK-00000000')});
  assert.equal(unknown.statusCode,404);
  const invalid=await app.inject({method:'GET',url:LOOKUP.replace('PK-A1B2C3D4','FAKE')});
  assert.equal(invalid.statusCode,400);
  assert.equal(db.transactions.length,0,'lookup cannot record money');
 }finally{await app.close();}
});

test('manual checkout verifies reference, posts one income and rejects duplicate confirmation',async()=>{
 const {app,db}=await createFixture();
 try{
  const created=await app.inject({method:'POST',url:paymentUrl,headers:{'idempotency-key':'checkoutTEST123456'},payload:{amountMinor:45000,method:'nequi'}});
  assert.equal(created.statusCode,201,created.body);
  const repeated=await app.inject({method:'POST',url:paymentUrl,headers:{'idempotency-key':'checkoutTEST123456'},payload:{amountMinor:45000,method:'nequi'}});
  assert.equal(repeated.statusCode,200,repeated.body);
  assert.equal(db.payments.length,1,'retry cannot duplicate payment');
  const pending=await app.inject({method:'GET',url:LOOKUP});
  assert.equal(pending.json().pendingPayments.length,1);
  assert.equal(db.transactions.length,0,'pending payment must not become income');
  const confirmUrl='/api/v1/tenants/'+TENANT+'/payments/'+created.json().id+'/confirm-manual';
  const noReference=await app.inject({method:'POST',url:confirmUrl,payload:{}});
  assert.equal(noReference.statusCode,400);
  assert.equal(db.transactions.length,0);
  const confirmed=await app.inject({method:'POST',url:confirmUrl,payload:{reference:'NEQ-4567'}});
  assert.equal(confirmed.statusCode,200,confirmed.body);
  assert.equal(db.transactions.length,1);
  assert.equal(db.transactions[0].amount,45000);
  const again=await app.inject({method:'POST',url:confirmUrl,payload:{reference:'NEQ-4567'}});
  assert.equal(again.statusCode,409);
  const paid=await app.inject({method:'GET',url:LOOKUP});
  assert.equal(paid.json().balanceMinor,0);
  assert.equal(paid.json().confirmedMinor,45000);
  assert.equal(paid.json().pendingPayments.length,0);
  const extra=await app.inject({method:'POST',url:paymentUrl,headers:{'idempotency-key':'checkoutTEST999999'},payload:{amountMinor:45000,method:'cash'}});
  assert.equal(extra.statusCode,409);
  assert.equal(db.transactions.length,1,'one order cannot create a second full payment');
 }finally{await app.close();}
});


test('staff may deliver only fully paid orders; delivery is idempotent and never duplicates income',async()=>{
 const {app,db}=await createFixture();
 const delivery='/api/v1/tenants/'+TENANT+'/orders/'+ORDER+'/deliver';
 try{
  const unpaid=await app.inject({method:'POST',url:delivery});
  assert.equal(unpaid.statusCode,409);
  const pending=await app.inject({method:'POST',url:paymentUrl,headers:{'idempotency-key':'checkoutDELIVER123'},payload:{amountMinor:45000,method:'cash'}});
  assert.equal(pending.statusCode,201,pending.body);
  const stillUnpaid=await app.inject({method:'POST',url:delivery});
  assert.equal(stillUnpaid.statusCode,409,'Pending is not confirmed cash');
  const confirmed=await app.inject({method:'POST',url:'/api/v1/tenants/'+TENANT+'/payments/'+pending.json().id+'/confirm-manual',payload:{}});
  assert.equal(confirmed.statusCode,200,confirmed.body);
  const delivered=await app.inject({method:'POST',url:delivery});
  assert.equal(delivered.statusCode,200,delivered.body);
  assert.equal(delivered.json().status,'delivered');
  const repeated=await app.inject({method:'POST',url:delivery});
  assert.equal(repeated.statusCode,200,repeated.body);
  assert.equal(db.transactions.length,1,'Delivering never records payment twice');
  assert.ok(!db.queries.some(q=>q.sql.includes('UPDATE public.products SET stock')),'Inventory must not be decremented again');
  const outsider=await app.inject({method:'POST',url:delivery,headers:{'x-test-user':'outsider'}});
  assert.equal(outsider.statusCode,403);
 }finally{await app.close();}
});
