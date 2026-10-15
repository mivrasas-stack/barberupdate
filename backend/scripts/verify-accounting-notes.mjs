import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
const url=process.env.ACCOUNTING_TEST_DATABASE_URL||'';
if(!/^postgres(ql)?:\/\/[^@]+@(?:127\.0\.0\.1|localhost):[0-9]+\//.test(url))
  throw Error('Only disposable local PostgreSQL may be used for accounting QA');
const pool=new pg.Pool({connectionString:url,max:2});
try{
 await pool.query("CREATE TABLE public.transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,type text NOT NULL,category text NOT NULL,concept text NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor>0),payment_method text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now())");
 const args=['11111111-1111-4111-8111-111111111111','expense','other','Old expense',2000,'cash','22222222-2222-4222-8222-222222222222'];
 const old=await pool.query('INSERT INTO public.transactions(tenant_id,type,category,concept,amount_minor,payment_method,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',args);
 const sql=readFileSync(new URL('../../supabase/migrations/20261015020100_transaction_notes.sql',import.meta.url),'utf8');
 await pool.query(sql);await pool.query(sql);
 const preserved=await pool.query('SELECT notes,amount_minor::int AS amount_minor FROM public.transactions WHERE id=$1',[old.rows[0].id]);
 assert.deepEqual(preserved.rows[0],{notes:'',amount_minor:2000});
 const created=await pool.query('INSERT INTO public.transactions(tenant_id,type,category,concept,amount_minor,payment_method,created_by,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,notes',[...args.slice(0,3),'QA receipt',1200,'transfer',args[6],'Factura QA-123']);
 assert.equal(created.rows[0].notes,'Factura QA-123');
 const reload=await pool.query('SELECT notes FROM public.transactions WHERE id=$1',[created.rows[0].id]);
 assert.equal(reload.rows[0].notes,'Factura QA-123');
 await assert.rejects(pool.query('INSERT INTO public.transactions(tenant_id,type,category,concept,amount_minor,payment_method,created_by,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[...args,'a'.repeat(1001)]),e=>e.code==='23514');
 const count=await pool.query('SELECT count(*)::int AS n FROM public.transactions');
 assert.equal(count.rows[0].n,2);
 console.log('PASS: non-destructive migration, notes persistence, length check');
} finally {await pool.end();}
