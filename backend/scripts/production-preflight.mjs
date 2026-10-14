// A pre-deployment GATE, not proof of backups, availability or audit.
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const yes=v=>v==='true';
const present=v=>typeof v==='string'&&v.trim().length>10;
const secureUrl=v=>{
  try {const x=new URL(v);return x.protocol==='https:'&&!x.username&&!x.password&&!x.search&&!x.hash;}
  catch{return false;}
};
export function assessProductionReadiness(env){
  const checks=[
    ['node_production',env.NODE_ENV==='production'],
    ['approved_explicitly',yes(env.BARBEROS_PRODUCTION_APPROVED)],
    ['public_https_url',secureUrl(env.BARBEROS_PUBLIC_API_URL)],
    ['public_domain_configured',present(env.BARBEROS_API_DOMAIN)&&!env.BARBEROS_API_DOMAIN.includes('example.')],
    ['cors_https_origins',present(env.CORS_ORIGINS)&&env.CORS_ORIGINS.split(',').every(v=>secureUrl(v.trim()))],
    ['supabase_https',secureUrl(env.SUPABASE_URL)],
    ['database_connection',/^(postgresql?):\/\//.test(env.DATABASE_URL||'')],
    ['supabase_server_secret',present(env.SUPABASE_SERVICE_ROLE_KEY)],
    ['redis_password',present(env.REDIS_PASSWORD)],
    ['backup_restore_test_attested',yes(env.BARBEROS_BACKUP_RESTORE_VERIFIED)],
    ['alerts_active_attested',yes(env.BARBEROS_ALERTS_VERIFIED)],
    ['penetration_review_attested',yes(env.BARBEROS_SECURITY_REVIEW_VERIFIED)],
    ['wompi_still_disabled',!present(env.WOMPI_PRIVATE_KEY) && !present(env.WOMPI_PUBLIC_KEY) && !yes(env.WOMPI_ENABLED)]
  ];
  return {ready:checks.every(x=>x[1]),checks:checks.map(([name,passed])=>({name,passed}))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const r=assessProductionReadiness(process.env);
 console.log(JSON.stringify(r));
 if(!r.ready)process.exitCode=1;
}
