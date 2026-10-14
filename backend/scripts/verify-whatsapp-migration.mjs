import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {randomUUID} from 'node:crypto';

// Runs only in GitHub Actions against a disposable PostgreSQL service (never real Supabase).
const pool=new pg.Pool({connectionString:process.env.WHATSAPP_TEST_DATABASE_URL,max:1});
const {Client}=pg;
try{
 await pool.query(`
 CREATE ROLE barberos_backend;
 CREATE ROLE anon;
 CREATE ROLE authenticated;
 CREATE TABLE public.tenants(id uuid PRIMARY KEY,name text,time_zone text,status text);
 CREATE TABLE public.appointments(
  id uuid PRIMARY KEY, tenant_id uuid REFERENCES public.tenants(id),
  customer_user_id uuid,customer_phone text,customer_name text,
  starts_at timestamptz,status text,reschedule_count integer NOT NULL DEFAULT 0
 );
 `);
 const sql=readFileSync(new URL('../../supabase/migrations/20261014000400_whatsapp_templates.sql',import.meta.url),'utf8');
 await pool.query(sql);
 const tenant=randomUUID(),user=randomUUID(),appt=randomUUID();
 await pool.query("INSERT INTO public.tenants(id,name,time_zone,status) VALUES($1,'QA Demo','America/Bogota','active')",[tenant]);
 await pool.query("INSERT INTO public.whatsapp_tenant_settings(tenant_id,enabled,templates) VALUES($1,false,$2)",[tenant,JSON.stringify({created:{name:'created_template',params:[]},reminder:{name:'reminder_template',params:[]},rescheduled:{name:'rescheduled_template',params:[]},cancelled:{name:'cancelled_template',params:[]}})]);
 await pool.query("INSERT INTO public.whatsapp_consents(tenant_id,user_id,phone_e164) VALUES($1,$2,'+573001234567')",[tenant,user]);
 await pool.query("INSERT INTO public.appointments(id,tenant_id,customer_user_id,customer_name,customer_phone,starts_at,status) VALUES($1,$2,$3,'Test','+573001234567',now()+interval '5 days','confirmed')",[appt,tenant,user]);
 let r=await pool.query('SELECT * FROM public.whatsapp_messages');
 assert.equal(r.rowCount,0,'Globally off business must never queue messages');
 await pool.query('UPDATE public.whatsapp_tenant_settings SET enabled=true WHERE tenant_id=$1',[tenant]);
 // Rebooking simulates the next newly accepted appointment after opt-in.
 const next=randomUUID();
 await pool.query("INSERT INTO public.appointments(id,tenant_id,customer_user_id,customer_name,customer_phone,starts_at,status) VALUES($1,$2,$3,'Test','+573001234567',now()+interval '5 days','confirmed')",[next,tenant,user]);
 r=await pool.query('SELECT event_kind,status FROM public.whatsapp_messages WHERE appointment_id=$1 ORDER BY event_kind',[next]);
 assert.deepEqual(r.rows.map(x=>x.event_kind),['created','reminder']);
 assert.ok(r.rows.every(x=>x.status==='queued'));
 await pool.query("UPDATE public.appointments SET starts_at=starts_at+interval '1 day',reschedule_count=1 WHERE id=$1",[next]);
 r=await pool.query('SELECT event_kind,event_version,status FROM public.whatsapp_messages WHERE appointment_id=$1 ORDER BY event_kind,event_version',[next]);
 assert.ok(r.rows.some(x=>x.event_kind==='rescheduled'&&x.event_version===1&&x.status==='queued'));
 assert.ok(r.rows.some(x=>x.event_kind==='reminder'&&x.event_version===0&&x.status==='suppressed'));
 await pool.query("UPDATE public.appointments SET status='cancelled' WHERE id=$1",[next]);
 r=await pool.query('SELECT event_kind,status FROM public.whatsapp_messages WHERE appointment_id=$1',[next]);
 assert.ok(r.rows.some(x=>x.event_kind==='cancelled'&&x.status==='queued'));
 assert.ok(r.rows.every(x=>x.event_kind!=='reminder'||x.status==='suppressed'));
 await pool.query('UPDATE public.whatsapp_consents SET revoked_at=now() WHERE tenant_id=$1 AND user_id=$2',[tenant,user]);
 r=await pool.query('SELECT status FROM public.whatsapp_messages WHERE appointment_id=$1',[next]);
 assert.ok(r.rows.every(x=>x.status==='suppressed'));
 console.log('WhatsApp migration safety: disabled, opt-in, reschedule, cancellation and opt-out passed');
}finally{await pool.end();}
