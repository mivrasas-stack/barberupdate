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
