import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {cleanupTestTenant} from './tenant-cleanup.js';

test('BarberOS E2E: Auth, schedule, bookings, orders, cleanup',
{skip:process.env.RUN_LIVE_API_INTEGRATION!=='1',timeout:120000},async()=>{
  const ref='wrfwhftzaflwhkvkzrjm';
  assert.ok((process.env.SUPABASE_URL||'').includes(ref),'Wrong Supabase project');
  const u=new URL(process.env.DATABASE_URL||'');
  assert.ok(u.username.includes(ref)||u.hostname.includes(ref),'Wrong PostgreSQL project');
  const base=process.env.API_TEST_BASE_URL||'http://127.0.0.1:8188';
  const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,
    {auth:{persistSession:false,autoRefreshToken:false}});
  const anon=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,
    {auth:{persistSession:false,autoRefreshToken:false}});
  const pool=new pg.Pool({connectionString:process.env.ADMIN_DATABASE_URL||process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
  let uid=null,tid=null,token=null;
  const call=async(method,path,body,key)=>{
    const r=await fetch(base+path,{method,
      headers:{...(token?{Authorization:'Bearer '+token}:{}),
        ...(body?{'Content-Type':'application/json'}:{}),
        ...(key?{'Idempotency-Key':key}:{})},
      body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
    return {status:r.status,data:await r.json().catch(()=>null)};
  };
  const check=(r,n,label)=>assert.equal(r.status,n,label+': '+JSON.stringify(r.data).slice(0,180));
  try{
    const email='barberos-itest-'+randomUUID()+'@example.com';
    const password='Ab!'+randomBytes(24).toString('hex');
    const newUser=await admin.auth.admin.createUser({email,password,email_confirm:true});
    assert.ifError(newUser.error);uid=newUser.data.user.id;
    const signin=await anon.auth.signInWithPassword({email,password});
    assert.ifError(signin.error);token=signin.data.session.access_token;
    check(await call('GET','/api/v1/me'),200,'Auth');
    const tenant=await call('POST','/api/v1/tenants',{
      name:'Barberos E2E',slug:'barberos-itest-'+randomBytes(8).toString('hex'),
      currency:'COP',timeZone:'America/Bogota'});
    check(tenant,201,'Create tenant');tid=tenant.data.id;
    const prefix='/api/v1/tenants/'+tid;
    const barber=await call('POST',prefix+'/barbers',{name:'Test Barber',slug:'test-barber'});
    check(barber,201,'Create barber');
    const service=await call('POST',prefix+'/services',{
      name:'Haircut',description:'',category:'haircut',priceMinor:25000,durationMinutes:30});
    check(service,201,'Create service');
    const bpath=prefix+'/barbers/'+barber.data.id;
    const hours=await call('PUT',bpath+'/hours',{intervals:
      Array.from({length:7},(_,weekday)=>({weekday,startMinute:540,endMinute:1080}))});
    check(hours,200,'Update weekly schedule');
    const day=new Date(Date.now()+20*86400000).toISOString().slice(0,10);
    const availability=await call('GET','/api/v1/public/tenants/'+tid+
      '/availability?barberId='+barber.data.id+'&serviceId='+service.data.id+'&date='+day);
    check(availability,200,'Public slots');
    assert.ok(availability.data.slots.length>0,'Must return available slots');
    const details={barberId:barber.data.id,serviceId:service.data.id,
      startsAt:availability.data.slots[0].starts_at,
      customerName:'Test Customer',customerPhone:'3000000000'};
    const bookingKey='booking-'+randomBytes(12).toString('hex');
    const booked=await call('POST',prefix+'/bookings',details,bookingKey);
    check(booked,201,'Book appointment');
    const replay=await call('POST',prefix+'/bookings',details,bookingKey);
    check(replay,200,'Booking replay');assert.equal(replay.data.id,booked.data.id);
    check(await call('POST',prefix+'/bookings',{...details,customerName:'Changed'},bookingKey),
      409,'Mismatched booking replay');
    check(await call('POST',prefix+'/bookings',details,'booking-'+randomBytes(12).toString('hex')),
      409,'Overlapping appointment');
    check(await call('POST',prefix+'/members',{userId:uid,role:'manager'}),409,'Owner immutability');
    const notification=await call('GET','/api/v1/me/notifications');
    check(notification,200,'Read notifications');
    assert.ok(notification.data.items.some(n=>n.category==='booking'),'New booking should notify customer');
    const mark=await call('PATCH','/api/v1/me/notifications/'+notification.data.items[0].id+'/read');
    check(mark,200,'Mark notification read');
    const customerCancel=await call('PATCH','/api/v1/me/bookings/'+booked.data.id+'/cancel');
    check(customerCancel,200,'Customer cancels booking');
    assert.equal(customerCancel.data.status,'cancelled');
    const freed=await call('GET','/api/v1/public/tenants/'+tid+
      '/availability?barberId='+barber.data.id+'&serviceId='+service.data.id+'&date='+day);
    check(freed,200,'Reopen cancelled slot');
    assert.ok(freed.data.slots.some(s=>s.starts_at===details.startsAt),'Cancelled slot must be available');
    const product=await call('POST',prefix+'/products',{name:'Hair Gel',
      sku:'ITEST-'+randomBytes(5).toString('hex'),priceMinor:12500,stock:4});
    check(product,201,'Create product');
    const purchase={customerName:'Test Customer',items:[{productId:product.data.id,quantity:2}]};
    const orderKey='order-'+randomBytes(12).toString('hex');
    const ordered=await call('POST',prefix+'/orders',purchase,orderKey);
    check(ordered,201,'Create order');
    const idem=await call('POST',prefix+'/orders',purchase,orderKey);
    check(idem,200,'Order replay');assert.equal(idem.data.id,ordered.data.id);
    const stock=await call('GET',prefix+'/products');check(stock,200,'Read stock');
    assert.equal(stock.data.find(p=>p.id===product.data.id).stock,2);
    check(await call('PATCH',prefix+'/orders/'+ordered.data.id+'/status',{status:'cancelled'}),
      200,'Cancel order');
    const restored=await call('GET',prefix+'/products');
    assert.equal(restored.data.find(p=>p.id===product.data.id).stock,4);
    const secondOrder=await call('POST',prefix+'/orders',
      {customerName:'Test Customer',items:[{productId:product.data.id,quantity:1}]},
      'order-'+randomBytes(12).toString('hex'));
    check(secondOrder,201,'Second order for manual payment');
    const transfer={amountMinor:12500,method:'transfer'};
    const manualKey='manual-'+randomBytes(12).toString('hex');
    const pending=await call('POST',prefix+'/orders/'+secondOrder.data.id+'/payments/manual',transfer,manualKey);
    check(pending,201,'Record pending manual payment');
    assert.equal(pending.data.status,'pending');
    const paymentReplay=await call('POST',prefix+'/orders/'+secondOrder.data.id+'/payments/manual',transfer,manualKey);
    check(paymentReplay,200,'Manual payment idempotent replay');
    assert.equal(paymentReplay.data.id,pending.data.id);
    check(await call('POST',prefix+'/orders/'+secondOrder.data.id+'/payments/manual',
      {...transfer,amountMinor:10000},manualKey),409,'Reject changed manual payment replay');
    check(await call('POST',prefix+'/payments/'+pending.data.id+'/confirm-manual',{}),
      400,'Require non-cash evidence');
    const confirmation=await call('POST',prefix+'/payments/'+pending.data.id+'/confirm-manual',
      {reference:'E2E-'+randomBytes(9).toString('hex')});
    check(confirmation,200,'Staff-attested manual transfer');
    assert.equal(confirmation.data.status,'confirmed');
    check(await call('POST',prefix+'/payments/'+pending.data.id+'/confirm-manual',{}),
      409,'No double manual confirmation');
    const summary=await call('GET',prefix+'/orders/'+secondOrder.data.id+'/payments');
    check(summary,200,'Manual payment ledger');
    assert.equal(Number(summary.data.confirmedMinor),12500);
    assert.equal(summary.data.balanceMinor,0);
    check(await call('PATCH',prefix+'/orders/'+secondOrder.data.id+'/status',{status:'cancelled'}),
      409,'Paid order requires refund, not silent cancellation');
    const options=await call('GET','/api/v1/public/payment-capabilities');
    check(options,200,'Payment capabilities');
    assert.equal(options.data.onlinePayments.enabled,false);
    assert.equal(options.data.onlinePayments.providerSelected,'wompi');
    const entry=await call('POST',prefix+'/transactions',{type:'income',category:'services',concept:'Test cash sale',amountMinor:10000,paymentMethod:'cash'});
    check(entry,201,'Record cash entry');
    const localDay=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Bogota'});
    const closing=await call('POST',prefix+'/cash-closings',{closingDate:localDay,openingCashMinor:0,withdrawalsMinor:0,actualCashMinor:10000});
    check(closing,201,'Atomic cash closing');
    assert.equal(Number(closing.data.theoretical_cash_minor),10000);
    const late=await call('POST',prefix+'/transactions',{type:'income',category:'services',concept:'Late sale',amountMinor:500,paymentMethod:'cash'});
    check(late,409,'Reject new transaction after daily closing');
    const from=new Date(Date.now()-2*86400000).toISOString().slice(0,10);
    const to=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
    const overview=await call('GET',prefix+'/reports/overview?from='+from+'&to='+to);
    check(overview,200,'Reports overview');
    assert.ok(overview.data.orders.total>=1,'Expected recorded order in report');
    const commission=await call('GET',prefix+'/reports/barbers?from='+from+'&to='+to);
    check(commission,200,'Barber commissions');
    const lowStock=await call('GET',prefix+'/inventory/low-stock?threshold=5');
    check(lowStock,200,'Low stock alert');
    assert.ok(lowStock.data.some(p=>p.id===product.data.id));
    console.log('PASS: E2E Auth, scheduling, booking, order, notifications, reports and cleanup');
  }finally{
    let cleanupError=null;
    if(tid){
      try {
        const removed=await cleanupTestTenant(pool,tid);
        assert.ok(removed,'Test tenant was not found during cleanup');
        console.log('CLEANUP: isolated tenant deleted');
      }catch(e){cleanupError=e;console.error('CLEANUP TENANT ERROR_CODE='+(e.code||e.name));}
    }
    if(uid){
      const removed=await admin.auth.admin.deleteUser(uid);
      if(removed.error)cleanupError=cleanupError||removed.error;
      console.log('CLEANUP: temporary auth user '+(removed.error?'FAILED':'deleted'));
    }
    await pool.end();
    if(cleanupError)throw cleanupError;
  }
});
