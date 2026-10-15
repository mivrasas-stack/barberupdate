import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import Fastify from 'fastify';
import {encryptSecret,decryptSecret,masterKey,safeIntegrationView} from '../src/integration-secrets.js';
import {registerPlatformIntegrationRoutes} from '../src/platform-integrations.js';

test('AES-GCM integration secrets round trip, no ciphertext/plaintext in admin response',()=>{
 const key=masterKey(randomBytes(32).toString('base64'));
 const a=encryptSecret('never-expose-this',key);
 assert.equal(decryptSecret(a,key),'never-expose-this');
 assert.notEqual(a,encryptSecret('never-expose-this',key));
 assert.throws(()=>decryptSecret(a,randomBytes(32)));
 const view=safeIntegrationView('openai',{enabled:true,settings:{model:'gpt-4.1-mini'},configured:['apiKey']});
 assert.equal(view.credentials.apiKey,true);
 assert.equal(JSON.stringify(view).includes('never-expose-this'),false);
});
test('platform integration endpoints require actual platform_admins membership',async()=>{
 const app=Fastify();
 const db={query:async(sql)=>({rowCount:sql.includes('platform_admins')?0:0,rows:[]})};
 const security={authenticated:async r=>{r.actor={id:'user',email:'x@example.com'};},limited:async()=>{}};
 await registerPlatformIntegrationRoutes(app,{config:{},db,security});
 const response=await app.inject({method:'GET',url:'/api/v1/platform/integrations'});
 assert.equal(response.statusCode,403);
 const save=await app.inject({method:'PUT',url:'/api/v1/platform/integrations/openai',
   payload:{enabled:true,settings:{model:'gpt-4.1-mini'},secrets:{apiKey:'secret'}}});
 assert.equal(save.statusCode,403);
 await app.close();
});

test('admin can save credential without echoing it, then preserve it on settings-only edit',async()=>{
 const key=randomBytes(32).toString('base64');
 const records=new Map();
 const db={
  async query(sql,args=[]){
   if(sql.includes('platform_admins'))return {rowCount:1,rows:[{ok:1}]};
   if(sql.includes('SELECT secrets FROM'))return records.has(args[0])?{rowCount:1,rows:[{secrets:records.get(args[0]).secrets}]}:{rowCount:0,rows:[]};
   if(sql.includes('SELECT enabled,settings,secrets'))return records.has(args[0])?{rowCount:1,rows:[records.get(args[0])]}:{rowCount:0,rows:[]};
   if(sql.includes('INSERT INTO public.platform_integrations')){
    records.set(args[0],{enabled:args[1],settings:JSON.parse(args[2]),secrets:JSON.parse(args[3]),updated_at:new Date().toISOString()});
    return {rowCount:1,rows:[]};
   }
   throw Error('Unexpected SQL in test');
  },
  async transaction(fn){return fn(this);}
 };
 const app=Fastify();
 const security={authenticated:async req=>{req.actor={id:'admin',email:'admin@example.com'};},limited:async()=>{}};
 await registerPlatformIntegrationRoutes(app,{config:{platformSecretsKey:key},db,security});
 const payload={enabled:true,settings:{model:'gpt-4.1-mini',systemPrompt:'Testing'},secrets:{apiKey:'sk-secret-never-expose'}};
 const first=await app.inject({method:'PUT',url:'/api/v1/platform/integrations/openai',payload});
 assert.equal(first.statusCode,200,first.body);
 assert.equal(first.json().credentials.apiKey,true);
 assert.equal(first.body.includes('sk-secret-never-expose'),false);
 const second=await app.inject({method:'PUT',url:'/api/v1/platform/integrations/openai',payload:{...payload,secrets:{}}});
 assert.equal(second.statusCode,200,second.body);
 const listing=await app.inject({method:'GET',url:'/api/v1/platform/integrations'});
 assert.equal(listing.statusCode,200,listing.body);
 assert.equal(listing.json().openai.credentials.apiKey,true);
 assert.equal(listing.body.includes('sk-secret-never-expose'),false);
 assert.equal(JSON.stringify(records.get('openai')).includes('sk-secret-never-expose'),false);
 await app.close();
});
