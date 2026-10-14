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
  let uid=null,tid=null,token=null,otherUid=null,otherTid=null,mediaPath=null,mediaBucket=null;
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
    const ownIdentity=await call('GET','/api/v1/me');
    check(ownIdentity,200,'Auth');
    assert.equal(ownIdentity.data.platformRole,null,'Ordinary tenant owners are never superadmins');
    check(await call('GET','/api/v1/platform/tenants'),403,'Only global administrators can access platform tenants');
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
    const edited=await call('PATCH',prefix+'/services/'+service.data.id,{
      name:'Haircut Updated',description:'Edited through live frontend contract',
      category:'haircut',priceMinor:25000,durationMinutes:30
    });
    check(edited,200,'Frontend can persist service edits');
    assert.equal(edited.data.name,'Haircut Updated');
    const listing=await call('GET',prefix+'/services');
    check(listing,200,'Frontend can list edited services');
    assert.ok(listing.data.some(x=>x.id===service.data.id&&x.name==='Haircut Updated'));
    const publicShops=await call('GET','/api/v1/public/tenants');
    check(publicShops,200,'Public tenant directory for client portal');
    assert.ok(publicShops.data.some(x=>x.id===tid));
    const bpath=prefix+'/barbers/'+barber.data.id;
    const hours=await call('PUT',bpath+'/hours',{intervals:
      Array.from({length:7},(_,weekday)=>({weekday,startMinute:540,endMinute:1080}))});
    check(hours,200,'Update weekly schedule');
    const otherEmail='barberos-itest-'+randomUUID()+'@example.com';
    const otherPassword='Ab!'+randomBytes(24).toString('hex');
    const otherUser=await admin.auth.admin.createUser({
      email:otherEmail,password:otherPassword,email_confirm:true
    });
    assert.ifError(otherUser.error);
    otherUid=otherUser.data.user.id;
    const otherClient=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,
      {auth:{persistSession:false,autoRefreshToken:false}});
    const otherSession=await otherClient.auth.signInWithPassword({
      email:otherEmail,password:otherPassword
    });
    assert.ifError(otherSession.error);
    const otherToken=otherSession.data.session.access_token;
    const otherCall=async(method,path,body)=>{
      const r=await fetch(base+path,{method,headers:{
        Authorization:'Bearer '+otherToken,...(body?{'Content-Type':'application/json'}:{})
      },body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
      return {status:r.status,data:await r.json().catch(()=>null)};
    };
    const otherTenant=await otherCall('POST','/api/v1/tenants',{
      name:'Isolated Barber Two',slug:'barberos-itest-'+randomBytes(8).toString('hex'),
      currency:'COP',timeZone:'America/Bogota'
    });
    check(otherTenant,201,'Other owner creates separate company');
    otherTid=otherTenant.data.id;
    check(await otherCall('GET',prefix+'/services'),403,'Reject cross-tenant services');
    check(await otherCall('PATCH',prefix+'/services/'+service.data.id,{
      name:'Unauthorized',description:'',category:'haircut',priceMinor:1,durationMinutes:30
    }),403,'Cannot edit services across tenants');
    check(await otherCall('GET',prefix+'/orders'),403,'Reject cross-tenant orders');
    check(await otherCall('GET',prefix+'/reports/overview?from=2026-10-01&to=2026-10-31'),
      403,'Reject cross-tenant financial reports');
    check(await otherCall('PUT',bpath+'/hours',{intervals:[]}),403,'Reject cross-tenant schedule edits');
    check(await otherCall('GET','/api/v1/tenants/'+otherTid+'/services'),200,
      'Second company owner can read their own company');
    check(await call('GET','/api/v1/tenants/'+otherTid+'/services'),403,
      'First company owner cannot read second company');
    check(await otherCall('POST',prefix+'/media/signed-upload',
      {mimeType:'image/png',kind:'logo'}),403,
      'Other tenant cannot sign image upload');
    const signed=await call('POST',prefix+'/media/signed-upload',
      {mimeType:'image/png',kind:'logo'});
    check(signed,201,'Owner signed upload');
    mediaPath=signed.data.path;
    mediaBucket=signed.data.bucket;
    assert.ok(mediaPath.startsWith(tid+'/logo/'),'Storage path must be tenant-scoped');
    const testImage=Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nK2cAAAAASUVORK5CYII=',
      'base64');
    const storageResult=await anon.storage.from(mediaBucket).uploadToSignedUrl(
      mediaPath,signed.data.token,
      new Blob([testImage],{type:'image/png'}),
      {contentType:'image/png',upsert:false});
    assert.ifError(storageResult.error);
    const publicImage=anon.storage.from(mediaBucket).getPublicUrl(mediaPath).data.publicUrl;
    const download=await fetch(publicImage,{signal:AbortSignal.timeout(12000)});
    assert.equal(download.status,200,'Signed upload must be accessible through public Storage URL');
    assert.ok((await download.arrayBuffer()).byteLength>=testImage.length);
    const day=new Date(Date.now()+20*86400000).toISOString().slice(0,10);
    const closedDay=await call('POST',prefix+'/closed-days',{date:day,reason:'Temporary closure test'});
    check(closedDay,201,'Owner creates exceptional closed day');
    const closedSlots=await call('GET','/api/v1/public/tenants/'+tid+
      '/availability?barberId='+barber.data.id+'&serviceId='+service.data.id+'&date='+day);
    check(closedSlots,200,'Closed day availability');
    assert.equal(closedSlots.data.slots.length,0,'Closed business must expose no available slots');
    check(await call('DELETE',prefix+'/closed-days/'+day),200,'Owner reopens date');
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
    check(await call('POST',prefix+'/closed-days',{date:day,reason:'Has existing bookings'}),
      409,'Cannot close a date with active appointments');
    const replay=await call('POST',prefix+'/bookings',details,bookingKey);
    check(replay,200,'Booking replay');assert.equal(replay.data.id,booked.data.id);
    check(await call('POST',prefix+'/bookings',{...details,customerName:'Changed'},bookingKey),
      409,'Mismatched booking replay');
    check(await call('POST',prefix+'/bookings',details,'booking-'+randomBytes(12).toString('hex')),
      409,'Overlapping appointment');
    const availableAfterBooking=await call('GET','/api/v1/public/tenants/'+tid+
      '/availability?barberId='+barber.data.id+'&serviceId='+service.data.id+'&date='+day);
    check(availableAfterBooking,200,'Alternate open slot');
    assert.ok(availableAfterBooking.data.slots.length>2);
    const alternate=availableAfterBooking.data.slots[0].starts_at;
    const moved=await call('PATCH','/api/v1/me/bookings/'+booked.data.id+'/reschedule',
      {startsAt:alternate});
    check(moved,200,'Customer reprograms own reservation');
    assert.equal(moved.data.reschedule_count,1);
    assert.equal(moved.data.starts_at,alternate);
    check(await call('PATCH','/api/v1/me/bookings/'+booked.data.id+'/reschedule',
      {startsAt:alternate}),409,'Reject noop reschedule');
    const anotherTime=availableAfterBooking.data.slots.find(x=>
      new Date(x.starts_at).getTime()>=new Date(alternate).getTime()+60*60000);
    assert.ok(anotherTime,'Need non-overlapping slot for staff rescheduling');
    const changedByStaff=await call('PATCH',prefix+'/appointments/'+booked.data.id+'/reschedule',
      {startsAt:anotherTime.starts_at});
    check(changedByStaff,200,'Owner reprograms tenant reservation');
    assert.equal(changedByStaff.data.reschedule_count,2);
    const bookingNotices=await call('GET','/api/v1/me/notifications');
    check(bookingNotices,200,'Read reschedule notices');
    assert.ok(bookingNotices.data.items.some(n=>n.event_status==='rescheduled-2'),
      'Customer should see reschedule notification');
    const syncFirst=await call('GET','/api/v1/me/notifications/sync?limit=2');
    check(syncFirst,200,'Durable sync first page');
    assert.ok(syncFirst.data.items.length>=1);
    assert.ok(syncFirst.data.nextCursor,'Sync first page needs a continuation cursor');
    const syncSecond=await call('GET','/api/v1/me/notifications/sync?limit=2&cursor='+
      encodeURIComponent(syncFirst.data.nextCursor));
    check(syncSecond,200,'Durable sync second page');
    const ids1=new Set(syncFirst.data.items.map(n=>n.id));
    assert.ok(syncSecond.data.items.every(n=>!ids1.has(n.id)),'No overlapping cursor messages');
    const blocker=await call('POST',prefix+'/bookings',
      {...details,startsAt:alternate},'blocker-'+randomBytes(12).toString('hex'));
    check(blocker,201,'Reserve other occupied slot');
    check(await call('PATCH','/api/v1/me/bookings/'+booked.data.id+'/reschedule',
      {startsAt:alternate}),409,'Cannot reschedule into another booked slot');
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
      sku:'ITEST-'+randomBytes(5).toString('hex'),priceMinor:12500,stock:4,
      description:'Original boutique form',photoUrl:'https://example.com/product.jpg',
      category:'food_drinks',costMinor:5500,minStock:2,waitingRoomVisible:true});
    check(product,201,'Create product');
    assert.equal(product.data.category,'food_drinks');
    assert.equal(Number(product.data.cost_minor),5500);
    const publicProductsPath='/api/v1/public/tenants/'+tid+'/products';
    const visible=await call('GET',publicProductsPath);
    check(visible,200,'Public boutique catalog');
    assert.ok(visible.data.some(x=>x.id===product.data.id));
    const hidden=await call('PATCH',prefix+'/products/'+product.data.id+'/visibility',{visible:false});
    check(hidden,200,'Owner can hide boutique product');
    const afterHide=await call('GET',publicProductsPath);
    check(afterHide,200,'Public boutique after hiding');
    assert.ok(afterHide.data.every(x=>x.id!==product.data.id));
    const shown=await call('PATCH',prefix+'/products/'+product.data.id+'/visibility',{visible:true});
    check(shown,200,'Owner can show boutique product');
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
    const refundPath=prefix+'/payments/'+pending.data.id+'/refund-manual';
    check(await otherCall('POST',refundPath,{amountMinor:5000,
      reason:'Customer refund requested',reference:'REF-'+randomBytes(8).toString('hex')}),
      403,'Other company owner cannot refund this payment');
    check(await call('POST',refundPath,{amountMinor:5000,reason:'Customer refund requested'},
      'refund-'+randomBytes(12).toString('hex')),400,'Bank refund requires receipt');
    const partialPayload={amountMinor:5000,reason:'Customer returned part of order',
      reference:'REF-'+randomBytes(9).toString('hex')};
    const refundKey='refund-'+randomBytes(12).toString('hex');
    const partialRefund=await call('POST',refundPath,partialPayload,refundKey);
    check(partialRefund,201,'Staff records partial refund');
    check(await call('POST',refundPath,partialPayload,refundKey),200,'Refund replay is idempotent');
    check(await call('POST',refundPath,{...partialPayload,amountMinor:5500},refundKey),
      409,'Changed refund replay rejected');
    check(await call('PATCH',prefix+'/orders/'+secondOrder.data.id+'/status',{status:'cancelled'}),
      409,'Partially refunded order cannot silently cancel');
    const remainder=await call('POST',refundPath,
      {amountMinor:7500,reason:'Remaining money returned to customer',
        reference:'REF-'+randomBytes(9).toString('hex')},
      'refund-'+randomBytes(12).toString('hex'));
    check(remainder,201,'Complete remaining refund');
    check(await call('POST',refundPath,{amountMinor:1,reason:'Over limit refund',
      reference:'REF-'+randomBytes(9).toString('hex')},'refund-'+randomBytes(12).toString('hex')),
      409,'Reject refund exceeding original confirmed payment');
    const refundedSummary=await call('GET',prefix+'/orders/'+secondOrder.data.id+'/payments');
    check(refundedSummary,200,'Refund audit ledger');
    assert.equal(Number(refundedSummary.data.refundedMinor),12500);
    assert.equal(Number(refundedSummary.data.netReceivedMinor),0);
    assert.equal(refundedSummary.data.refunds.length,2);
    check(await call('PATCH',prefix+'/orders/'+secondOrder.data.id+'/status',
      {status:'cancelled'}),200,'Cancel fully refunded order and return stock');
    const afterRefund=await call('GET',prefix+'/products');
    check(afterRefund,200,'Stock restored after refunded cancellation');
    assert.equal(afterRefund.data.find(p=>p.id===product.data.id).stock,4);
    const options=await call('GET','/api/v1/public/payment-capabilities');
    check(options,200,'Payment capabilities');
    assert.equal(options.data.onlinePayments.enabled,false);
    assert.equal(options.data.onlinePayments.providerSelected,null);
    assert.equal(options.data.platformBilling.providerSelected,'wompi');
    assert.equal(options.data.platformBilling.scope,'barberos_saas_subscriptions');
    assert.equal(options.data.platformBilling.enabled,false);
    assert.equal(options.data.subscriptionBilling.enabled,false);
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
    if(mediaPath){
      try{
        const removed=await admin.storage.from(mediaBucket).remove([mediaPath]);
        assert.ifError(removed.error);
        console.log('CLEANUP: temporary signed image removed from Supabase Storage');
      }catch(e){
        cleanupError=e;
        console.error('CLEANUP STORAGE ERROR_TYPE='+(e.name||'unknown'));
      }
    }
    if(otherTid){
      try {await cleanupTestTenant(pool,otherTid);
        console.log('CLEANUP: second isolated tenant deleted');
      }catch(e){cleanupError=e;console.error('CLEANUP SECOND TENANT ERROR_CODE='+(e.code||e.name));}
    }
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
    if(otherUid){
      const removed=await admin.auth.admin.deleteUser(otherUid);
      if(removed.error)cleanupError=cleanupError||removed.error;
      console.log('CLEANUP: second temporary auth user '+(removed.error?'FAILED':'deleted'));
    }
    await pool.end();
    if(cleanupError)throw cleanupError;
  }
});
