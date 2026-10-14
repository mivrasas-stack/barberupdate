// Isolated BarberOS PUBLIC schema stream restore. NO Auth or Storage backup.
// No backup file created; ephemeral postgres instance with --network none.
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const ref='wrfwhftzaflwhkvkzrjm';
const u=new URL(process.env.ADMIN_DATABASE_URL||'');
if(!u.username.includes(ref)||!u.hostname.endsWith('.pooler.supabase.com')||!u.password)
  throw Error('Refusing to connect to any project other than the dedicated BarberOS DB');
const container='barberos-restore-'+randomBytes(5).toString('hex');
const startedAt=Date.now();
const pass=decodeURIComponent(u.password);
function safe(error){return String(error||'').replaceAll(pass,'[REDACTED]').slice(0,1200);}
async function run(args,environment=process.env){
  return new Promise((resolve,reject)=>{
    const child=spawn('docker',args,{env:environment,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',b=>{stdout+=b.toString().slice(0,1500);});
    child.stderr.on('data',b=>{stderr+=b.toString().slice(0,1500);});
    child.once('error',reject);
    child.once('close',code=>code===0?resolve(stdout):reject(Error('docker exit '+code+': '+safe(stderr))));
  });
}
async function copy(){
  const dump=spawn('docker',[
    'run','--rm','-i','-e','PGPASSWORD','-e','PGSSLMODE=require','postgres:17-alpine',
    'pg_dump','-h',u.hostname,'-p',u.port||'5432','-U',decodeURIComponent(u.username),
    '-d',u.pathname.slice(1)||'postgres','--schema=public','--format=custom',
    '--no-owner','--no-acl','--lock-wait-timeout=3000'
  ],{windowsHide:true,env:{...process.env,PGPASSWORD:pass},stdio:['ignore','pipe','pipe']});
  const restore=spawn('docker',['exec','-i',container,'pg_restore','-U','postgres',
    '-d','postgres','--no-owner','--no-acl','--exit-on-error'],
    {windowsHide:true,stdio:['pipe','pipe','pipe']});
  let dumpedError='',restoredError='',bytes=0;
  dump.stderr.on('data',b=>{dumpedError+=b.toString().slice(0,1600);});
  restore.stderr.on('data',b=>{restoredError+=b.toString().slice(0,1600);});
  dump.stdout.on('data',b=>{bytes+=b.length;});
  dump.stdout.pipe(restore.stdin);
  restore.stdin.on('error',()=>{});
  const wait=p=>new Promise((res,rej)=>{p.once('error',rej);p.once('close',res);});
  const [dumpCode,restoreCode]=await Promise.all([wait(dump),wait(restore)]);
  if(dumpCode!==0||restoreCode!==0)
    throw Error('dump_exit='+dumpCode+' restore_exit='+restoreCode+'; '+
      safe(dumpedError)+'; '+safe(restoredError));
  return bytes;
}
let created=false;
try{
  await run(['run','-d','--rm','--name',container,'--network','none',
    '-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);
  created=true;
  let ready=false;
  for(let i=0;i<28;i++){
    try{await run(['exec',container,'pg_isready','-U','postgres']);ready=true;break;}
    catch{await new Promise(resolve=>setTimeout(resolve,650));}
  }
  if(!ready)throw Error('Isolated postgres not ready');
  const commands=[
    'DROP SCHEMA IF EXISTS public CASCADE',
    'CREATE SCHEMA IF NOT EXISTS auth',
    'CREATE SCHEMA IF NOT EXISTS extensions',
    "DO $q$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $q$",
    "DO $q$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; END $q$",
    "DO $q$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF; END $q$",
    "DO $q$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='barberos_backend') THEN CREATE ROLE barberos_backend NOLOGIN; END IF; END $q$",
    'CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $q$ SELECT NULL::uuid $q$',
    'CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions',
    'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions'
  ].join(';\n')+';';
  await run(['exec',container,'psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-c',commands]);
  const bytes=await copy();
  const query="SELECT json_build_object("+
    "'tables',(SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'),"+
    "'rls',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity),"+
    "'plans',(SELECT count(*) FROM public.subscription_plans),"+
    "'triggers',(SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal),"+
    "'policies',(SELECT count(*) FROM pg_policies WHERE schemaname='public')"+
    ")";
  const out=await run(['exec',container,'psql','-U','postgres','-d','postgres','-At','-c',query]);
  const stats=JSON.parse(out.trim().split('\n').find(v=>v.startsWith('{')));
  if(stats.tables!==24||stats.rls!==24||stats.plans!==3||stats.triggers<12||stats.policies<24)
    throw Error('Restored verification failed '+JSON.stringify(stats));
  console.log('PUBLIC_SCHEMA_RESTORE=PASS');
  console.log('RESTORED_METRICS='+JSON.stringify(stats));
  console.log('STREAM_BYTES='+bytes);
  console.log('DURATION_SECONDS='+Math.round((Date.now()-startedAt)/1000));
  console.log('LIMITATIONS=public_schema_only;Auth_and_Storage_not_backed_up');
}finally{
  if(created){
    try{await run(['rm','-f',container]);console.log('ISOLATED_CONTAINER_REMOVED=YES');}
    catch{console.log('RESTORE_CONTAINER_CLEANUP_WARNING='+container);}
  }
}
