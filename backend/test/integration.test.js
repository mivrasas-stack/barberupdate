import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const expectedProject='wrfwhftzaflwhkvkzrjm';
const connectionString=process.env.ADMIN_DATABASE_URL||process.env.DATABASE_URL||'';
const run=process.env.RUN_DB_INTEGRATION==='1';

test('BarberOS PostgreSQL integration: isolation, schedules and integrity', {skip: !run}, async()=>{
  const u=new URL(connectionString);
  assert.ok(u.username.includes(expectedProject)||u.hostname.includes(expectedProject),'Refusing to test a different Supabase project');
  const pool=new pg.Pool({connectionString,max:1,connectionTimeoutMillis:10000});
  const db=await pool.connect();
  const owner=randomUUID(), customer=randomUUID(), barberId=randomUUID(), serviceId=randomUUID();
  const slug='itest-'+randomUUID().replaceAll('-','').slice(0,18);
  let inTransaction=false;
  try{
    await db.query('BEGIN');inTransaction=true;
    const t=await db.query(
      'INSERT INTO public.tenants(slug,name,owner_user_id) VALUES($1,$2,$3) RETURNING id',
      [slug,'Isolated Integration Test',owner]);
    const tenant=t.rows[0].id;
    await db.query("INSERT INTO public.tenant_members(tenant_id,user_id,role) VALUES($1,$2,'owner')",[tenant,owner]);
    const rejects=async(sql,args,expected)=>{
      await db.query('SAVEPOINT isolated_case');
      try{
        await db.query(sql,args);
        assert.fail('Expected PostgreSQL to reject invalid state');
      }catch(e){
        if(e.code===undefined) throw e;
        assert.equal(e.code,expected);
      }finally{await db.query('ROLLBACK TO SAVEPOINT isolated_case');await db.query('RELEASE SAVEPOINT isolated_case');}
    };
    await rejects("UPDATE public.tenant_members SET role='manager' WHERE tenant_id=$1 AND user_id=$2",[tenant,owner],'23514');
    await rejects("DELETE FROM public.tenant_members WHERE tenant_id=$1 AND user_id=$2",[tenant,owner],'23514');
    await rejects("INSERT INTO public.tenant_members(tenant_id,user_id,role) VALUES($1,$2,'owner')",[tenant,customer],'23514');
    await rejects('UPDATE public.tenants SET owner_user_id=$2 WHERE id=$1',[tenant,customer],'23514');

    await db.query("INSERT INTO public.barbers(id,tenant_id,name,slug) VALUES($1,$2,'Test barber','test-barber')",[barberId,tenant]);
    await db.query("INSERT INTO public.services(id,tenant_id,name,price_minor,duration_minutes) VALUES($1,$2,'Test Service',150000,30)",[serviceId,tenant]);
    for(let day=0;day<7;day++)
      await db.query("INSERT INTO public.barber_work_intervals(tenant_id,barber_id,weekday,start_minute,end_minute) VALUES($1,$2,$3,540,1080)",[tenant,barberId,day]);
    const timestamp=await db.query(
      "SELECT (($1::date + INTERVAL '10 hours') AT TIME ZONE 'America/Bogota') AS starts, (($1::date + INTERVAL '10 hours 30 minutes') AT TIME ZONE 'America/Bogota') AS ends, (($1::date + INTERVAL '12 hours') AT TIME ZONE 'America/Bogota') AS absent_start, (($1::date + INTERVAL '13 hours') AT TIME ZONE 'America/Bogota') AS absent_end",
      [new Date(Date.now()+20*86400000).toISOString().slice(0,10)]);
    const {starts,ends,absent_start,absent_end}=timestamp.rows[0];
    const bookingSQL='INSERT INTO public.appointments(tenant_id,barber_id,service_id,customer_user_id,customer_name,customer_phone,created_by,starts_at,ends_at,price_minor,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$4,$7,$8,150000,$9)';
    const bookingArgs=[tenant,barberId,serviceId,customer,'Test customer','000000',starts,ends,'test-'+randomUUID()];
    await db.query(bookingSQL,bookingArgs);
    const overlapArgs=[...bookingArgs];overlapArgs[8]='overlap-'+randomUUID();
    await rejects(bookingSQL,overlapArgs,'23P01');
    const tooEarly=await db.query(
      "SELECT (($1::date + interval '7 hours') AT TIME ZONE 'America/Bogota') AS a, (($1::date + interval '7 hours 30 minutes') AT TIME ZONE 'America/Bogota') AS b",
      [new Date(Date.now()+20*86400000).toISOString().slice(0,10)]);
    const outside=[...bookingArgs];outside[6]=tooEarly.rows[0].a;outside[7]=tooEarly.rows[0].b;outside[8]='early-'+randomUUID();
    await rejects(bookingSQL,outside,'23514');
    await db.query('INSERT INTO public.barber_time_off(tenant_id,barber_id,starts_at,ends_at,reason,created_by) VALUES($1,$2,$3,$4,$5,$6)',
      [tenant,barberId,absent_start,absent_end,'Test holiday',owner]);
    const noAccess=[...bookingArgs];noAccess[6]=new Date(absent_start.getTime()+15*60000);noAccess[7]=new Date(absent_start.getTime()+45*60000);noAccess[8]='leave-'+randomUUID();
    await rejects(bookingSQL,noAccess,'23514');
    const appointment=await db.query('SELECT id FROM public.appointments WHERE tenant_id=$1',[tenant]);
    const apptId=appointment.rows[0].id;
    await db.query("UPDATE public.appointments SET status='completed' WHERE id=$1",[apptId]);
    await db.query("UPDATE public.appointments SET status='completed' WHERE id=$1",[apptId]);
    const loyalty=await db.query('SELECT points,visits_count FROM public.loyalty_accounts WHERE tenant_id=$1 AND user_id=$2',[tenant,customer]);
    assert.equal(loyalty.rows[0].points,10);
    assert.equal(loyalty.rows[0].visits_count,1);
    const notices=await db.query("SELECT event_status FROM public.notifications WHERE tenant_id=$1 AND user_id=$2 AND category='booking'",[tenant,customer]);
    assert.ok(notices.rows.some(n=>n.event_status==='completed'));
    assert.ok(notices.rows.some(n=>n.event_status==='pending'));
    console.log('PASS: ownership, non-overlap, work hours, time off, exactly-once loyalty and notifications');
  }finally{
    if(inTransaction) await db.query('ROLLBACK');
    db.release();
    await pool.end();
  }
  const clean=new pg.Pool({connectionString,max:1});
  try{
    const a=await clean.query('SELECT 1 FROM public.tenants WHERE slug=$1',[slug]);
    assert.equal(a.rowCount,0,'Integration fixture was not rolled back');
  }finally{await clean.end();}
});
