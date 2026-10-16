import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {HttpProblem} from '../src/security.js';
import {registerBusinessRoutes} from '../src/business.js';

const tenant='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const owner='33333333-3333-4333-8333-333333333333';
const saleId=n=>'44444444-4444-4444-8444-'+String(n).padStart(12,'0');
const url='/api/v1/tenants/'+tenant+'/orders/sales-history';

async function setup(){
  const queries=[];
  let available=Array.from({length:24},(_,i)=>({
    id:saleId(i+1),pickup_code:'PK-'+String(i+1).padStart(8,'0'),
    customer_name:i%2?'Cliente María':'Cliente Pedro',status:'delivered',
    total_minor:15000,confirmed_minor:15000,refunded_minor:i===2?5000:0,
    created_at:new Date(2026,9,24-i).toISOString(),last_paid_at:new Date(2026,9,24-i).toISOString(),
    payment_details:[{id:saleId(100+i),amountMinor:15000,method:i%2?'nequi':'cash',
      confirmedAt:new Date(2026,9,24-i).toISOString(),reference:i%2?'NEQ-456':null}]
  }));
  const db={queries,async query(sql,args){
    queries.push({sql,args});
    if(sql.includes('WITH paid_orders AS (')){
      assert.match(sql,/EXISTS \([\s\S]*status='confirmed'/);
      assert.match(sql,/o\.tenant_id=\$1/);
      assert.match(sql,/ORDER BY o\.created_at DESC,o\.id DESC/);
      assert.match(sql,/public\.manual_refunds/);
      assert.match(sql,/strpos\(lower\(o\.customer_name\)/);
      let rows=available;
      if(args[2])rows=rows.filter(x=>x.customer_name.toLowerCase().includes(args[2])||x.pickup_code.toLowerCase().includes(args[2]));
      if(args[1])rows=rows.slice(rows.findIndex(x=>x.id===args[1])+1);
      return {rowCount:Math.min(rows.length,args[3]),rows:rows.slice(0,args[3])};
    }
    if(sql.includes('FROM public.order_items oi LEFT JOIN public.products p')){
      assert.equal(args[0],tenant);
      assert.ok(Array.isArray(args[1])&&args[1].length>0);
      return {rows:args[1].flatMap(id=>[
        {order_id:id,product_name:'Pomada',category:'beauty',quantity:1,unit_price_minor:5000,subtotal_minor:5000},
        {order_id:id,product_name:'Café',category:'food_drinks',quantity:1,unit_price_minor:5000,subtotal_minor:5000},
        {order_id:id,product_name:'Gorra',category:'barbershop_merch',quantity:1,unit_price_minor:5000,subtotal_minor:5000}
      ])};
    }
    throw Error('Unexpected or mutating query: '+sql);
  }};
  const app=Fastify({logger:false});
  const security={
    authenticated:async req=>{req.actor={id:req.headers['x-actor']==='outsider'?'outsider':owner};},
    limited:async()=>{},
    requireTenant:async(_db,t,u,roles)=>{
      if(t!==tenant||u!==owner||!roles.some(role=>['owner','manager'].includes(role)))
        throw new HttpProblem(403,'Sin permiso');
      return 'owner';
    }
  };
  await registerBusinessRoutes(app,{db,security});
  await app.ready();
  return {app,db,setSales:(list)=>{available=list;}};
}

test('history shows confirmed sale per order, payments, refunds, and all three product categories',async()=>{
  const {app,db}=await setup();
  try{
    const result=await app.inject({url,method:'GET'});
    assert.equal(result.statusCode,200,result.body);
    const body=result.json();
    assert.equal(body.sales.length,20);
    assert.equal(body.nextCursor,saleId(20));
    assert.equal(body.sales[0].netMinor,15000);
    assert.equal(body.sales[2].refundedMinor,5000);
    assert.equal(body.sales[2].netMinor,10000);
    assert.equal(body.sales[0].payments[0].method,'cash');
    assert.deepEqual(body.sales[0].items.map(i=>i.category),['beauty','food_drinks','barbershop_merch']);
    assert.equal(db.queries[0].args[0],tenant);
    assert.equal(db.queries[0].args[3],21,'Fetch one extra row to indicate older sales');
    assert.equal(db.queries.filter(q=>/^INSERT|^UPDATE|^DELETE/.test(q.sql.trim())).length,0);
  }finally{await app.close();}
});

test('older pages remain accessible; search applies across all historical orders',async()=>{
  const {app,db}=await setup();
  try{
    const first=await app.inject({url,method:'GET'});
    const cursor=first.json().nextCursor;
    const second=await app.inject({url:url+'?cursor='+cursor,method:'GET'});
    assert.equal(second.statusCode,200,second.body);
    assert.equal(second.json().sales.length,4);
    assert.equal(second.json().nextCursor,null);
    const search=await app.inject({url:url+'?q=mAr%C3%ADa',method:'GET'});
    assert.equal(search.statusCode,200,search.body);
    assert.equal(search.json().sales.length,12);
    assert.ok(search.json().sales.every(s=>s.customerName.includes('María')));
    assert.equal(db.queries.find(q=>q.args?.[2]==='maría').args[2],'maría');
    const code=await app.inject({url:url+'?q=PK-00000001',method:'GET'});
    assert.equal(code.json().sales.length,1);
    const invalidCursor=await app.inject({url:url+'?cursor=not-a-uuid',method:'GET'});
    assert.equal(invalidCursor.statusCode,400);
    const invalidLimit=await app.inject({url:url+'?limit=500',method:'GET'});
    assert.equal(invalidLimit.statusCode,400);
  }finally{await app.close();}
});

test('history rejects outsiders and another business before querying payment information',async()=>{
  const {app,db}=await setup();
  try{
    const outsider=await app.inject({url,headers:{'x-actor':'outsider'}});
    assert.equal(outsider.statusCode,403);
    const foreign=await app.inject({url:'/api/v1/tenants/'+other+'/orders/sales-history'});
    assert.equal(foreign.statusCode,403);
    assert.equal(db.queries.length,0);
  }finally{await app.close();}
});

test('empty history returns no sales and no cursor, without fetching item details',async()=>{
  const {app,db,setSales}=await setup();
  setSales([]);
  try{
    const result=await app.inject({url,method:'GET'});
    assert.equal(result.statusCode,200,result.body);
    assert.deepEqual(result.json(),{sales:[],nextCursor:null});
    assert.equal(db.queries.length,1);
  }finally{await app.close();}
});
