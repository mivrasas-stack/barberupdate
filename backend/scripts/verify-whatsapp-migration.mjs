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
  starts_at timestamptz,ends_at timestamptz,barber_id uuid,status text,reschedule_count integer NOT NULL DEFAULT 0
 );
 `);
 const sql=readFileSync(new URL('../../supabase/migrations/20261014000400_whatsapp_templates.sql',import.meta.url),'utf8');
 await pool.query(sql);
 // Simulate the independently deployed legacy queue, with no pending messages.
 await pool.query("CREATE TABLE public.whatsapp_deliveries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text NOT NULL DEFAULT 'pending')");
 await pool.query("CREATE OR REPLACE FUNCTION public.barberos_whatsapp_enqueue() RETURNS trigger LANGUAGE plpgsql AS $ BEGIN INSERT INTO public.whatsapp_deliveries(status) VALUES('pending'); RETURN NEW; END $");
 await pool.query("CREATE TRIGGER appointments_whatsapp_queue AFTER INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.barberos_whatsapp_enqueue()");
 // An unprocessed legacy job must block automatic retirement.
 await pool.query("INSERT INTO public.whatsapp_deliveries DEFAULT VALUES");
 const bridgeSql=readFileSync(new URL('../../supabase/migrations/20261015010300_whatsapp_legacy_bridge.sql',import.meta.url),'utf8');
 await assert.rejects(pool.query(bridgeSql),/Legacy WhatsApp queue has/);
 await pool.query("DELETE FROM public.whatsapp_deliveries WHERE status='pending'");
 await pool.query(bridgeSql);
 const trg=await pool.query("SELECT tgname FROM pg_trigger WHERE tgrelid='public.appointments'::regclass AND NOT tgisinternal");
 assert.ok(trg.rows.some(x=>x.tgname==='appt_whatsapp_enqueue'),'New queue trigger must remain');
 assert.ok(!trg.rows.some(x=>x.tgname==='appointments_whatsapp_queue'),'Legacy producer must be retired');
 const oldCount=await pool.query('SELECT count(*)::int AS n FROM public.whatsapp_deliveries');
 assert.equal(oldCount.rows[0].n,0);
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
