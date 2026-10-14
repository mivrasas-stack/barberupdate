import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import Fastify from 'fastify';
import {registerWhatsAppRoutes} from '../src/whatsapp-routes.js';
import {HttpProblem} from '../src/security.js';
const TENANT='11111111-1111-4111-8111-111111111111';
const ACTOR='22222222-2222-4222-8222-222222222222';
async function fixture(){
  const app=Fastify(),calls=[];
  const db={
    query:async(sql,args)=>{
      calls.push({sql,args});
      if(sql.includes('SELECT 1 FROM public.appointments'))return {rowCount:0,rows:[]};
      if(sql.includes('whatsapp_tenant_settings WHERE'))return {rowCount:0,rows:[]};
      return {rowCount:0,rows:[]};
    },
    transaction:async work=>work(db),
  };
  const config={whatsappSendEnabled:false,whatsappAccessToken:'',
    whatsappPhoneNumberId:'12345678901',whatsappWebhookVerifyToken:'verify-123',whatsappAppSecret:'app-secret'};
  const security={
    authenticated:async(req)=>{req.actor={id:ACTOR};},
    limited:async()=>{},
    requireTenant:async(_db,tenant,_actor,roles)=>{
      if(tenant!==TENANT||!roles.includes('owner'))throw new HttpProblem(403,'Forbidden');
      return 'owner';
    },
  };
  await registerWhatsAppRoutes(app,{config,db,security});await app.ready();
  return {app,calls};
}

test('tenant settings are restricted and sending cannot be activated without Meta server keys',async()=>{
  const {app}=await fixture();
  try{
    const settings=await app.inject({method:'GET',url:'/api/v1/tenants/'+TENANT+'/whatsapp/settings'});
    assert.equal(settings.statusCode,200,settings.body);
    assert.equal(settings.json().enabled,false);
    const another=await app.inject({method:'GET',url:'/api/v1/tenants/33333333-3333-4333-8333-333333333333/whatsapp/settings'});
    assert.equal(another.statusCode,403,another.body);
    const rejected=await app.inject({method:'PUT',url:'/api/v1/tenants/'+TENANT+'/whatsapp/settings',payload:{
      enabled:true,languageCode:'es_CO',reminderHours:24,
      templates:{created:{name:'cita_confirmada',params:['customer_name']}}
    }});
    assert.equal(rejected.statusCode,409,rejected.body);
  }finally{await app.close();}
});

test('consent cannot be granted for somebody else\'s appointment phone',async()=>{
  const {app,calls}=await fixture();
  try{
    const unauthorized=await app.inject({method:'POST',url:'/api/v1/me/whatsapp/consent',payload:{
      tenantId:TENANT,phone:'+573001234567',consent:true
    }});
    assert.equal(unauthorized.statusCode,403,unauthorized.body);
    const revoked=await app.inject({method:'POST',url:'/api/v1/me/whatsapp/consent',payload:{
      tenantId:TENANT,phone:'+573001234567',consent:false
    }});
    assert.equal(revoked.statusCode,200,revoked.body);
    assert.ok(calls.some(x=>x.sql.includes('revoked_at=COALESCE')));
    assert.ok(calls.some(x=>x.args?.includes(ACTOR)));
  }finally{await app.close();}
});

test('webhook handshake checks verify token and signature against raw body',async()=>{
  const {app,calls}=await fixture();
  try{
    const challenge=await app.inject({method:'GET',url:'/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-123&hub.challenge=okay'});
    assert.equal(challenge.statusCode,200,challenge.body);
    assert.equal(challenge.body,'okay');
    const wrong=await app.inject({method:'GET',url:'/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=okay'});
    assert.equal(wrong.statusCode,403,wrong.body);
    const content=JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{
      value:{metadata:{phone_number_id:'12345678901'},statuses:[{id:'wamid.test',status:'delivered'}]}
    }]}]});
    const unsigned=await app.inject({method:'POST',url:'/api/v1/whatsapp/webhook',headers:{'content-type':'application/json'},payload:content});
    assert.equal(unsigned.statusCode,403,unsigned.body);
    const signature='sha256='+createHmac('sha256','app-secret').update(Buffer.from(content)).digest('hex');
    const valid=await app.inject({method:'POST',url:'/api/v1/whatsapp/webhook',headers:{
      'content-type':'application/json','x-hub-signature-256':signature
    },payload:content});
    assert.equal(valid.statusCode,200,valid.body);
    assert.ok(calls.some(x=>x.args?.includes('wamid.test')));
  }finally{await app.close();}
});
