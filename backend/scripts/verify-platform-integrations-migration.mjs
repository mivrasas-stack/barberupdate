import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';

// Disposable CI PostgreSQL ONLY. Never run against a production database.
const base=process.env.INTEGRATIONS_TEST_DATABASE_URL;
if(!base||!base.includes('localhost')&&!base.includes('127.0.0.1'))
 throw Error('This test is only allowed against a local disposable database');
const admin=new pg.Pool({connectionString:base});
let backend,anon;
try{
 await admin.query("CREATE ROLE barberos_backend LOGIN PASSWORD 'integration_backend_ci'");
 await admin.query("CREATE ROLE anon LOGIN PASSWORD 'integration_anon_ci'");
 await admin.query('CREATE ROLE authenticated');
 await admin.query('GRANT USAGE ON SCHEMA public TO barberos_backend,anon');
 const sql=readFileSync(new URL('../../supabase/migrations/20261014000500_platform_integrations.sql',import.meta.url),'utf8');
 await admin.query(sql);
 const u=new URL(base);
 const connect=async(user,password)=>{
  const pool=new pg.Pool({host:u.hostname,port:Number(u.port)||5432,database:u.pathname.slice(1),user,password,max:1});
  await pool.query('SELECT 1');return pool;
 };
 backend=await connect('barberos_backend','integration_backend_ci');
 anon=await connect('anon','integration_anon_ci');
 await backend.query("INSERT INTO public.platform_integrations(provider,settings,secrets) VALUES('openai',$1::jsonb,$2::jsonb)",[
  JSON.stringify({model:'gpt-4.1-mini'}),JSON.stringify({apiKey:'encrypted-only-test'})
 ]);
 const found=await backend.query("SELECT provider,settings FROM public.platform_integrations WHERE provider='openai'");
 assert.equal(found.rowCount,1);
 assert.equal(found.rows[0].settings.model,'gpt-4.1-mini');
 await assert.rejects(anon.query('SELECT * FROM public.platform_integrations'),/permission denied/);
 await assert.rejects(anon.query("INSERT INTO public.platform_integrations(provider) VALUES('email')"),/permission denied/);
 const policies=await admin.query("SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='platform_integrations'");
 assert.ok(policies.rows.some(x=>x.policyname==='platform_integrations_backend'));
 console.log('Platform integrations migration: schema, admin role grants and anon denial verified');
}finally{
 await backend?.end();await anon?.end();await admin.end();
}
