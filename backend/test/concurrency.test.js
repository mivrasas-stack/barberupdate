// Explicit opt-in; run against the dedicated BarberOS project only.
// Exercises multi-user authorization and real concurrent bookings/orders.
// All fixtures are created under a random barberos-itest tenant and removed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {cleanupTestTenant} from './tenant-cleanup.js';

const ref='wrfwhftzaflwhkvkzrjm';
const key=()=>randomBytes(12).toString('hex');
const permittedBase='http://127.0.0.1:8188';

test('Live RBAC and concurrency: owner, manager, barber and competing sales',
  {skip:process.env.RUN_LIVE_CONCURRENCY!=='1',timeout:125000}, async()=>{
  assert.ok((process.env.SUPABASE_URL||'').includes(ref),'Wrong Auth project');
  const uri=new URL(process.env.DATABASE_URL||'');
  assert.ok(uri.username.includes(ref)||uri.hostname.includes(ref),'Wrong DB project');
  const base=process.env.API_TEST_BASE_URL||permittedBase;
  assert.ok(base.startsWith('http://127.0.0.1:'),'Live concurrency test must stay localhost');
  const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,
    {auth:{persistSession:false,autoRefreshToken:false}});
  const db=new pg.Pool({
    connectionString:process.env.ADMIN_DATABASE_URL||process.env.DATABASE_URL,
    max:2,connectionTimeoutMillis:10000
  });
  const createdUsers=[];
  let tenantId=null;
  const request=async(token,method,path,body,idempotency)=>{
    const response=await fetch(base+path,{
      method,headers:{Authorization:'Bearer '+token,
        ...(body?{'Content-Type':'application/json'}:{}),
        ...(idempotency?{'Idempotency-Key':idempotency}:{})},
      body:body?JSON.stringify(body):undefined,
      signal:AbortSignal.timeout(14000)
    });
    return {status:response.status,data:await response.json().catch(()=>null)};
  };
  const expect=(response,code,label)=>assert.equal(
    response.status,code,label+' '+JSON.stringify(response.data)?.slice(0,180));
  const newUser=async()=>{
    const email='barberos-itest-'+randomUUID()+'@example.com';
    const password='Ab!'+randomBytes(24).toString('hex');
    const u=await admin.auth.admin.createUser({email,password,email_confirm:true});
    assert.ifError(u.error);
    createdUsers.push(u.data.user.id);
    const anon=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,
      {auth:{persistSession:false,autoRefreshToken:false}});
    const sign=await anon.auth.signInWithPassword({email,password});
    assert.ifError(sign.error);
    return {id:u.data.user.id,token:sign.data.session.access_token};
  };
  try{
    const owner=await newUser(),manager=await newUser(),barber=await newUser();
    const tenant=await request(owner.token,'POST','/api/v1/tenants',{
      name:'RBAC race test',slug:'barberos-itest-'+key().slice(0,16),
      currency:'COP',timeZone:'America/Bogota'
    });
    expect(tenant,201,'Tenant creation');tenantId=tenant.data.id;
    const prefix='/api/v1/tenants/'+tenantId;
    expect(await request(owner.token,'POST',prefix+'/members',
      {userId:manager.id,role:'manager'}),201,'Owner invites manager');
    expect(await request(owner.token,'POST',prefix+'/members',
      {userId:barber.id,role:'barber'}),201,'Owner invites barber');
    expect(await request(manager.token,'POST',prefix+'/members',
      {userId:barber.id,role:'manager'}),403,'Manager cannot assign roles');
    expect(await request(barber.token,'POST',prefix+'/products',
      {name:'Forbidden',sku:'FORBIDDEN',priceMinor:10000,stock:1}),
      403,'Barber cannot create product');
    expect(await request(barber.token,'GET',prefix+'/reports/overview?from=2026-10-01&to=2026-10-31'),
      403,'Barber cannot view financial reporting');
    const ownBarber=await request(owner.token,'POST',prefix+'/barbers',
      {name:'Linked barber',slug:'linked',userId:barber.id});
    expect(ownBarber,201,'Create barber linked to staff member');
    const otherBarber=await request(owner.token,'POST',prefix+'/barbers',
      {name:'Other barber',slug:'other'});
    expect(otherBarber,201,'Create second barber');
    const hours={intervals:Array.from({length:7},(_,weekday)=>({
      weekday,startMinute:540,endMinute:1080
    }))};
    expect(await request(manager.token,'PUT',prefix+'/barbers/'+ownBarber.data.id+'/hours',hours),
      200,'Manager can set staff hours');
    expect(await request(owner.token,'PUT',prefix+'/barbers/'+otherBarber.data.id+'/hours',hours),
      200,'Owner can set second schedule');
    expect(await request(barber.token,'GET',prefix+'/barbers/'+ownBarber.data.id+'/hours'),
      200,'Barber can read own schedule');
    expect(await request(barber.token,'GET',prefix+'/barbers/'+otherBarber.data.id+'/hours'),
      403,'Barber cannot read another schedule');
    const service=await request(manager.token,'POST',prefix+'/services',{
      name:'Concurrent service',description:'',priceMinor:15000,
      durationMinutes:30,category:'haircut'
    });
    expect(service,201,'Manager can create service');
    const day=new Date(Date.now()+18*86400000).toISOString().slice(0,10);
    const query='/api/v1/public/tenants/'+tenantId+'/availability?barberId='+
      ownBarber.data.id+'&serviceId='+service.data.id+'&date='+day;
    const slots=await fetch(base+query,{signal:AbortSignal.timeout(14000)}).then(r=>r.json());
    assert.ok(slots.slots.length>=2,'Must return available slots');
    const slot=slots.slots[0].starts_at;
    const booking={barberId:ownBarber.data.id,serviceId:service.data.id,
      startsAt:slot,customerName:'Concurrency Customer',customerPhone:'3000000000'};
    const bookings=await Promise.all([
      request(owner.token,'POST',prefix+'/bookings',booking,'book-'+key()),
      request(manager.token,'POST',prefix+'/bookings',booking,'book-'+key())
    ]);
    assert.deepEqual(bookings.map(x=>x.status).sort((a,b)=>a-b),[201,409],
      'Exactly one competing reservation must succeed');
    const appts=await db.query(
      "SELECT count(*)::int AS n FROM public.appointments WHERE tenant_id=$1 AND barber_id=$2 AND starts_at=$3 AND status IN ('pending','confirmed')",
      [tenantId,ownBarber.data.id,slot]);
    assert.equal(appts.rows[0].n,1,'One DB reservation for one slot');
    const schedule=await request(barber.token,'GET',
      prefix+'/appointments?start='+encodeURIComponent(new Date(Date.now()+17*86400000).toISOString())+
      '&end='+encodeURIComponent(new Date(Date.now()+20*86400000).toISOString()));
    expect(schedule,200,'Barber sees own appointments');
    assert.ok(schedule.data.some(x=>x.barber_id===ownBarber.data.id));
    assert.ok(schedule.data.every(x=>x.barber_id===ownBarber.data.id),
      'Barber must never see unassigned appointments');

    const stock=await request(owner.token,'POST',prefix+'/products',{
      name:'Last product',sku:'RACE-'+key(),priceMinor:18000,stock:1
    });
    expect(stock,201,'Seed one remaining product');
    const purchase={customerName:'Buyer',items:[{productId:stock.data.id,quantity:1}]};
    const [orderA,orderB]=await Promise.all([
      request(owner.token,'POST',prefix+'/orders',purchase,'order-'+key()),
      request(manager.token,'POST',prefix+'/orders',purchase,'order-'+key())
    ]);
    assert.deepEqual([orderA.status,orderB.status].sort((a,b)=>a-b),[201,409],
      'Stock=1: exactly one purchase can reserve inventory');
    const inventory=await db.query(
      'SELECT stock FROM public.products WHERE tenant_id=$1 AND id=$2',
      [tenantId,stock.data.id]);
    assert.equal(inventory.rows[0].stock,0,'Stock must not become negative');
    const nOrders=await db.query(
      'SELECT count(*)::int AS n FROM public.orders WHERE tenant_id=$1',
      [tenantId]);
    assert.equal(nOrders.rows[0].n,1,'No duplicate orders under stock race');
    // The same client retried concurrently must obtain exactly one row.
    const another=await request(owner.token,'POST',prefix+'/products',{
      name:'Idempotent product',sku:'IDEMP-'+key(),priceMinor:16000,stock:3
    });
    expect(another,201,'Stock for idempotent replay');
    const sameKey='order-'+key();
    const sameBody={customerName:'Replay buyer',
      items:[{productId:another.data.id,quantity:1}]};
    const [replay1,replay2]=await Promise.all([
      request(owner.token,'POST',prefix+'/orders',sameBody,sameKey),
      request(owner.token,'POST',prefix+'/orders',sameBody,sameKey)
    ]);
    assert.deepEqual([replay1.status,replay2.status].sort((a,b)=>a-b),[200,201]);
    assert.equal(replay1.data.id,replay2.data.id,'Replay must return same order');
    const stockNow=await db.query(
      'SELECT stock FROM public.products WHERE tenant_id=$1 AND id=$2',
      [tenantId,another.data.id]);
    assert.equal(stockNow.rows[0].stock,2,'Idempotency should debit stock once');
    console.log('PASS: owner/manager/barber permissions, cross-role privacy, parallel booking 201/409, parallel orders 201/409, same-key replay 200/201');
  }finally{
    let failed=null;
    if(tenantId){
      try{await cleanupTestTenant(db,tenantId);console.log('CLEANUP: race tenant removed');}
      catch(e){failed=e;console.error('CLEANUP_TENANT_CODE='+(e.code||e.name));}
    }
    for(const userId of createdUsers){
      const deleted=await admin.auth.admin.deleteUser(userId);
      if(deleted.error)failed=failed||deleted.error;
    }
    console.log('CLEANUP: temporary Auth users processed='+createdUsers.length);
    await db.end();
    if(failed)throw failed;
  }
});
