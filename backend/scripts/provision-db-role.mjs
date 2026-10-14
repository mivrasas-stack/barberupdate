// One-time local provisioning. Does not log or publish any credentials.
// Requires admin DATABASE_URL in backend/.env. Refuses other Supabase projects.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import pg from 'pg';

const ref='wrfwhftzaflwhkvkzrjm';
const envFile=new URL('../.env',import.meta.url);
const privateBackup=new URL('../.env.admin.local',import.meta.url);
const data=readFileSync(envFile,'utf8');
const line=data.split(/\r?\n/).find(x=>x.startsWith('DATABASE_URL='));
if(!line) throw new Error('Missing DATABASE_URL');
const oldUrl=line.slice('DATABASE_URL='.length).trim();
const uri=new URL(oldUrl);
if(uri.username!=='postgres.'+ref||!uri.hostname.endsWith('.pooler.supabase.com'))
  throw new Error('Refusing to provision: expected dedicated BarberOS admin pooler connection');
if(existsSync(privateBackup))throw new Error('Admin credentials backup already exists; refusing to overwrite');
const login='barberos_backend.'+ref;
const secret=randomBytes(32).toString('hex');
const newUri=new URL(oldUrl);
newUri.username=login;
newUri.password=secret;
const pool=new pg.Pool({connectionString:oldUrl,max:1,connectionTimeoutMillis:10000});
let updated=false;
try{
  const p=await pool.query('SELECT current_user AS name');
  if(p.rows[0].name!=='postgres') throw new Error('Not connected as PostgreSQL administrator');
  await pool.query("ALTER ROLE barberos_backend WITH LOGIN PASSWORD '"+secret+"'");
  updated=true;
  const candidate=new pg.Pool({connectionString:newUri.toString(),max:1,connectionTimeoutMillis:10000});
  try{
    const check=await candidate.query('SELECT count(*)::int AS count FROM public.subscription_plans');
    if(check.rows[0].count<3)throw new Error('Dedicated app role cannot read BarberOS schema');
    const policy=await candidate.query("SELECT rolbypassrls FROM pg_roles WHERE rolname='barberos_backend'");
    if(policy.rows[0].rolbypassrls)throw new Error('App role unexpectedly bypasses RLS');
  }finally{await candidate.end();}
  // Files live in git-ignored paths and contain server-side credentials only.
  writeFileSync(privateBackup,'ADMIN_DATABASE_URL='+oldUrl+'\r\n',{encoding:'utf8',flag:'wx',mode:0o600});
  writeFileSync(envFile,data.replace(/^DATABASE_URL=.*$/m,'DATABASE_URL='+newUri.toString()),'utf8');
  console.log('APP_DATABASE_ROLE_CONNECTED=YES');
  console.log('APP_DATABASE_RLS_BYPASS=NO');
  console.log('ADMIN_DATABASE_URL_SAVED_TO_IGNORED_LOCAL_FILE=YES');
  console.log('BACKEND_DATABASE_URL_SWITCHED_TO_LEAST_PRIVILEGE=YES');
}catch(e){
  console.log('APP_ROLE_PROVISION_FAILED_TYPE='+(e.code||e.name));
  if(updated){
    await pool.query('ALTER ROLE barberos_backend NOLOGIN').catch(()=>{});
    console.log('UNVERIFIED_DB_ROLE_DISABLED=YES');
  }
  process.exitCode=1;
}finally{await pool.end();}
