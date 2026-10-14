import test from 'node:test';
import assert from 'node:assert/strict';
import {assessProductionReadiness} from '../scripts/production-preflight.mjs';

const valid={
 NODE_ENV:'production',BARBEROS_PRODUCTION_APPROVED:'true',
 BARBEROS_PUBLIC_API_URL:'https://api.barberos.test',
 BARBEROS_API_DOMAIN:'api.barberos.test',
 CORS_ORIGINS:'https://barberos.test,https://app.barberos.test',
 SUPABASE_URL:'https://project.supabase.co',
 DATABASE_URL:'postgresql://user:placeholder@pooler.supabase.co:5432/postgres',
 SUPABASE_SERVICE_ROLE_KEY:'dummy_server_key_not_real',
 REDIS_PASSWORD:'dummy_superlong_password_notreal',
 BARBEROS_BACKUP_RESTORE_VERIFIED:'true',
 BARBEROS_ALERTS_VERIFIED:'true',BARBEROS_SECURITY_REVIEW_VERIFIED:'true'
};
test('production preflight refuses local or unapproved deployment',()=>{
 const out=assessProductionReadiness({...valid,
  BARBEROS_PRODUCTION_APPROVED:'false',
  BARBEROS_PUBLIC_API_URL:'http://127.0.0.1:8188',
  CORS_ORIGINS:'http://localhost:5173'});
 assert.equal(out.ready,false);
 assert.ok(out.checks.filter(x=>!x.passed).length>=3);
});
test('production preflight refuses private Wompi keys until future SaaS checkout',()=>{
 const out=assessProductionReadiness({...valid,WOMPI_PRIVATE_KEY:'private_token_example_12345678'});
 assert.equal(out.ready,false);
 assert.equal(out.checks.find(x=>x.name==='wompi_still_disabled').passed,false);
});
test('production preflight reports readiness only when operator attests all external gates',()=>{
 const out=assessProductionReadiness(valid);
 assert.equal(out.ready,true);
 assert.equal(out.checks.length,13);
});
