// Opt-in authenticated Supabase Realtime test. Tests the project-owned
// notifications feed and explicitly checks isolation from another user.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {cleanupTestTenant} from './tenant-cleanup.js';

const ref='wrfwhftzaflwhkvkzrjm';
const random=()=>randomBytes(8).toString('hex');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('Supabase Realtime sends owner notification and blocks unrelated user',
  {skip:process.env.RUN_LIVE_REALTIME!=='1',timeout:100000},async()=>{
  assert.ok((process.env.SUPABASE_URL||'').includes(ref),'Wrong Supabase Auth project');
  const uri=new URL(process.env.DATABASE_URL||'');
  assert.ok(uri.username.includes(ref)||uri.hostname.includes(ref),'Wrong Postgres project');
  const base=process.env.API_TEST_BASE_URL||'http://127.0.0.1:8188';
  assert.ok(base.startsWith('http://127.0.0.1:'),'Realtime test must use local API');
  const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,
    {auth:{persistSession:false,autoRefreshToken:false}});
  const pool=new pg.Pool({connectionString:process.env.ADMIN_DATABASE_URL||process.env.DATABASE_URL,
    max:1,connectionTimeoutMillis:10000});
  const ownedUsers=[],realtimeClients=[];
  let tenantId=null;
  const makeUser=async()=>{
    const email='barberos-itest-'+randomUUID()+'@example.com';
    const password='Ab!'+randomBytes(24).toString('hex');
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
    assert.ifError(created.error);
    ownedUsers.push(created.data.user.id);
    const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,
      {auth:{persistSession:false,autoRefreshToken:false},
       realtime:{params:{eventsPerSecond:2}}});
    realtimeClients.push(client);
    const login=await client.auth.signInWithPassword({email,password});
    assert.ifError(login.error);
    const token=login.data.session.access_token;
    await client.realtime.setAuth(token);
    return {id:created.data.user.id,token,client};
  };
  const api=async(token,method,path,payload,key)=>{
    const r=await fetch(base+path,{
      method,headers:{Authorization:'Bearer '+token,
        ...(payload?{'Content-Type':'application/json'}:{}),
        ...(key?{'Idempotency-Key':key}:{})},
      body:payload?JSON.stringify(payload):undefined,
      signal:AbortSignal.timeout(12000)
    });
    return {status:r.status,body:await r.json().catch(()=>null)};
  };
  const expect=(r,status,label)=>assert.equal(r.status,status,label+' '+JSON.stringify(r.body)?.slice(0,160));
  const watch=(client,userId,handler)=>{
    const channel=client.channel('barberos-realtime-itest-'+random(),{config:{private:false}})
      .on('postgres_changes',{
        event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+userId
      },handler);
    const connected=new Promise((resolve,reject)=>{
      const stop=setTimeout(()=>reject(new Error('Realtime SUBSCRIBED timeout')),17000);
      channel.subscribe(s=>{
        if(s==='SUBSCRIBED'){clearTimeout(stop);resolve();}
        if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'||s==='CLOSED'){
          clearTimeout(stop);reject(new Error('Realtime subscription status '+s));
        }
      });
    });
    return {channel,connected};
  };
  try{
    const owner=await makeUser(),outsider=await makeUser();
    const tenant=await api(owner.token,'POST','/api/v1/tenants',{
      name:'Realtime tenant',slug:'barberos-itest-'+random(),currency:'COP',
      timeZone:'America/Bogota'
    });
    expect(tenant,201,'Create realtime test tenant');
    tenantId=tenant.body.id;
    const prefix='/api/v1/tenants/'+tenantId;
    const barber=await api(owner.token,'POST',prefix+'/barbers',
      {name:'Realtime barber',slug:'rt-barber'});
    expect(barber,201,'Create barber');
    const service=await api(owner.token,'POST',prefix+'/services',
      {name:'Realtime haircut',category:'haircut',description:'',priceMinor:17000,durationMinutes:30});
    expect(service,201,'Create service');
    const intervals=Array.from({length:7},(_,weekday)=>({
      weekday,startMinute:540,endMinute:1080
    }));
    expect(await api(owner.token,'PUT',prefix+'/barbers/'+barber.body.id+'/hours',
      {intervals}),200,'Configure schedule');
    const received=[],leaked=[],unfiltered=[];
    const ownerListener=watch(owner.client,owner.id,payload=>received.push(payload.new));
    const foreignListener=watch(outsider.client,owner.id,payload=>leaked.push(payload.new));
    const diagnosticChannel=owner.client.channel('barberos-all-notifs-'+random())
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications'},
        payload=>unfiltered.push(payload.new));
    const diagnosticsReady=new Promise((resolve,reject)=>{
      const expiry=setTimeout(()=>reject(new Error('Diagnostics channel timeout')),17000);
      diagnosticChannel.subscribe(s=>{
        if(s==='SUBSCRIBED'){clearTimeout(expiry);resolve();}
        if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'){
          clearTimeout(expiry);reject(new Error('Diagnostics status '+s));
        }
      });
    });
    await Promise.all([ownerListener.connected,foreignListener.connected,diagnosticsReady]);
    const day=new Date(Date.now()+18*86400000).toISOString().slice(0,10);
    const avail=await fetch(base+'/api/v1/public/tenants/'+tenantId+
      '/availability?barberId='+barber.body.id+'&serviceId='+service.body.id+
      '&date='+day,{signal:AbortSignal.timeout(12000)}).then(r=>r.json());
    assert.ok(avail.slots.length>0,'No free slot for realtime smoke');
    const booked=await api(owner.token,'POST',prefix+'/bookings',{
      barberId:barber.body.id,serviceId:service.body.id,
      startsAt:avail.slots[0].starts_at,customerName:'Realtime test',
      customerPhone:'3000000000'
    },'rtbook-'+random());
    expect(booked,201,'Booking inserts notification event');
    const ownerRows=await owner.client.from('notifications')
      .select('id,user_id,reference_id').eq('reference_id',booked.body.id);
    assert.ifError(ownerRows.error);
    assert.equal(ownerRows.data.length,1,'Owner RLS allows read of their own event');
    const outsiderRows=await outsider.client.from('notifications')
      .select('id,user_id,reference_id').eq('reference_id',booked.body.id);
    assert.ifError(outsiderRows.error);
    assert.equal(outsiderRows.data.length,0,'Outsider RLS refuses event');
    console.log('REALTIME_DIAG_REST_RLS=PASS');
    for(let i=0;i<60&&!received.some(n=>n.reference_id===booked.body.id);i++)await pause(500);
    console.log('REALTIME_DIAG_FILTERED='+received.length+
      ' UNFILTERED='+unfiltered.length+' FOREIGN='+leaked.length);
    assert.ok(received.some(n=>n.reference_id===booked.body.id&&n.user_id===owner.id),
      'Owner should receive own notification via Realtime');
    await pause(2000);
    assert.equal(leaked.length,0,'Outsider must not receive owner notification');
    console.log('PASS: owner received Realtime notification; unrelated authenticated user received none');
  }finally{
    for(const client of realtimeClients){
      try{await client.removeAllChannels();}catch{}
    }
    let failed=null;
    if(tenantId){
      try{await cleanupTestTenant(pool,tenantId);console.log('CLEANUP: realtime test tenant deleted');}
      catch(e){failed=e;console.error('CLEANUP_REALTIME_TENANT_CODE='+(e.code||e.name));}
    }
    for(const uid of ownedUsers){
      const outcome=await admin.auth.admin.deleteUser(uid);
      if(outcome.error)failed=failed||outcome.error;
    }
    console.log('CLEANUP: realtime test users processed='+ownedUsers.length);
    await pool.end();
    if(failed)throw failed;
  }
});
