import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import pg from 'pg';

const url=process.env.SCALABILITY_TEST_DATABASE_URL;
if(!url||!/^postgres(ql)?:\/\/[^@]+@(?:127\.0\.0\.1|localhost):[0-9]+\//.test(url))
 throw Error('Only a disposable local PostgreSQL instance may run concurrency tests');
const pool=new pg.Pool({connectionString:url,max:20,connectionTimeoutMillis:5000});
try{
 await pool.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
 await pool.query('CREATE TABLE public.barber_join_requests(id uuid PRIMARY KEY,user_id uuid NOT NULL,tenant_id uuid NOT NULL,status text,created_at timestamptz NOT NULL DEFAULT now())');
 await pool.query('CREATE TABLE public.customer_links(user_id uuid NOT NULL,tenant_id uuid NOT NULL,barber_id uuid NOT NULL,PRIMARY KEY(user_id,tenant_id))');
 await pool.query('CREATE TABLE public.outbox_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,processed_at timestamptz,attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now())');
 await pool.query('CREATE TABLE public.whatsapp_deliveries(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,due_at timestamptz NOT NULL DEFAULT now())');
 const sql=readFileSync(new URL('../../supabase/migrations/20261015010100_scalability_foundation.sql',import.meta.url),'utf8');
 await pool.query(sql);await pool.query(sql);
 const result=await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname='public'");
 for(const index of ['idx_barber_join_requests_user_id','idx_customer_links_tenant_barber','idx_outbox_ready_claim','idx_whatsapp_deliveries_tenant_due'])
  assert.ok(result.rows.some(r=>r.indexname===index),'Missing index: '+index);
 await pool.query('INSERT INTO public.outbox_events(tenant_id) SELECT gen_random_uuid() FROM generate_series(1,150)');
 const claims=await Promise.all(Array.from({length:12},async()=>{
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   const found=await client.query("SELECT id FROM public.outbox_events WHERE processed_at IS NULL AND next_attempt_at<=now() AND attempts<12 ORDER BY next_attempt_at,id LIMIT 20 FOR UPDATE SKIP LOCKED");
   await client.query('SELECT pg_sleep(0.025)');
   if(found.rows.length)await client.query('UPDATE public.outbox_events SET processed_at=now() WHERE id=ANY($1::uuid[])',[found.rows.map(x=>x.id)]);
   await client.query('COMMIT');
   return found.rows.map(x=>x.id);
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }));
 const ids=claims.flat();
 assert.equal(ids.length,150);assert.equal(new Set(ids).size,150);
 await pool.query("CREATE TABLE public.scalability_appointments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,barber_id uuid NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'pending',CONSTRAINT scal_no_overlap EXCLUDE USING gist(tenant_id WITH =,barber_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE (status IN ('pending','confirmed','waiting','in_service')))");
 const tenant=randomUUID(),barber=randomUUID();
 const inserts=await Promise.all(Array.from({length:50},async()=>{
  try{
   await pool.query("INSERT INTO public.scalability_appointments(tenant_id,barber_id,starts_at,ends_at) VALUES($1,$2,'2027-01-01T14:00:00Z','2027-01-01T14:30:00Z')",[tenant,barber]);return true;
  }catch(e){if(e.code==='23P01')return false;throw e;}
 }));
 assert.equal(inserts.filter(Boolean).length,1);
 await pool.query("INSERT INTO public.scalability_appointments(tenant_id,barber_id,starts_at,ends_at) VALUES($1,$2,'2027-01-01T14:00:00Z','2027-01-01T14:30:00Z')",[randomUUID(),barber]);
 await pool.query('CREATE TABLE public.scalability_inventory(id integer PRIMARY KEY,stock integer NOT NULL CHECK(stock>=0))');
 await pool.query('INSERT INTO public.scalability_inventory(id,stock) VALUES(1,10)');
 const purchases=await Promise.all(Array.from({length:50},async()=>{
  const r=await pool.query('UPDATE public.scalability_inventory SET stock=stock-1 WHERE id=1 AND stock>0 RETURNING id');return r.rowCount>0;
 }));
 assert.equal(purchases.filter(Boolean).length,10);
 assert.equal((await pool.query('SELECT stock FROM public.scalability_inventory WHERE id=1')).rows[0].stock,0);
 console.log('PASS: 150 unique queue claims / 50 conflicting bookings => 1 reservation / 50 purchases => 10 sales.');
}finally{await pool.end();}
