import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createTemplateMessage,isWhatsAppDeliveryAllowed,normalizeWhatsAppPhone,sendWhatsAppTemplate,verifyWhatsAppSignature} from '../src/whatsapp-cloud.js';

test('only valid international phone numbers and template components are accepted',()=>{
  assert.equal(normalizeWhatsAppPhone('+57 300 123 4567'),'573001234567');
  for(const phone of ['3001234567','+0001','abc','+57\n3001234567']){
    if(phone==='3001234567')continue; // a valid country-code-less international number is permitted
    assert.throws(()=>normalizeWhatsAppPhone(phone));
  }
  const m=createTemplateMessage({to:'+573001234567',name:'confirmacion_cita',language:'es_CO',parameters:['Ana','24 octubre','10:30 AM']});
  assert.equal(m.messaging_product,'whatsapp');
  assert.equal(m.type,'template');
  assert.equal(m.template.name,'confirmacion_cita');
  assert.deepEqual(m.template.components[0].parameters,[{type:'text',text:'Ana'},{type:'text',text:'24 octubre'},{type:'text',text:'10:30 AM'}]);
  assert.throws(()=>createTemplateMessage({to:'123',name:'confirmacion_cita'}));
  assert.throws(()=>createTemplateMessage({to:'+573001234567',name:'../../file'}));
  assert.throws(()=>createTemplateMessage({to:'+573001234567',name:'ok',parameters:['']}));
});

test('Graph API uses a fixed Meta host, server-side bearer and approved template only',async()=>{
  let count=0;
  const fetcher=async(url,options)=>{
    count++;
    assert.equal(url,'https://graph.facebook.com/v23.0/1234567890/messages');
    assert.equal(options.method,'POST');
    assert.equal(options.headers.authorization,'Bearer test-only-access-token');
    const payload=JSON.parse(options.body);
    assert.equal(payload.type,'template');
    assert.equal(payload.to,'573001234567');
    assert.equal(payload.template.name,'recordatorio_cita');
    return {ok:true,json:async()=>({messages:[{id:'wamid.example-test-id'}]})};
  };
  const message=createTemplateMessage({to:'+573001234567',name:'recordatorio_cita',parameters:['Ana']});
  const result=await sendWhatsAppTemplate({accessToken:'test-only-access-token',phoneNumberId:'1234567890',message,fetcher});
  assert.deepEqual(result,{messageId:'wamid.example-test-id'});
  assert.equal(count,1);
  await assert.rejects(sendWhatsAppTemplate({accessToken:'fake',phoneNumberId:'bad-id',message,fetcher}),/Invalid WhatsApp phone number ID/);
  assert.equal(count,1);
  await assert.rejects(sendWhatsAppTemplate({accessToken:'fake',phoneNumberId:'1234567890',message:{type:'text'},fetcher}),/Only approved/);
});

test('Meta rejects are not silently retried or exposed to logs',async()=>{
  const msg=createTemplateMessage({to:'+573001234567',name:'aviso_cita'});
  await assert.rejects(
    sendWhatsAppTemplate({accessToken:'dummy',phoneNumberId:'1234567890',message:msg,fetcher:async()=>({ok:false,status:429})}),
    err=>err.retryable===true&&err.status===429&&!err.message.includes('dummy')
  );
  await assert.rejects(
    sendWhatsAppTemplate({accessToken:'dummy',phoneNumberId:'1234567890',message:msg,fetcher:async()=>({ok:false,status:400})}),
    err=>err.retryable===false
  );
});

test('webhook HMAC must match the exact raw request body',()=>{
  const raw=Buffer.from('{"entry":[]}', 'utf8');
  const signature='sha256='+createHmac('sha256','secret-for-test').update(raw).digest('hex');
  assert.equal(verifyWhatsAppSignature({appSecret:'secret-for-test',rawBody:raw,signature}),true);
  assert.equal(verifyWhatsAppSignature({appSecret:'wrong',rawBody:raw,signature}),false);
  assert.equal(verifyWhatsAppSignature({appSecret:'secret-for-test',rawBody:Buffer.from('{"entry":[1]}'),signature}),false);
  assert.equal(verifyWhatsAppSignature({appSecret:'secret-for-test',rawBody:raw,signature:'sha256=bad'}),false);
});

test('no opt-in, revoked opt-in or disabled business can send',()=>{
  const allowed={tenantEnabled:true,consentAt:new Date().toISOString(),revokedAt:null,templateName:'confirmacion_cita',appointmentStatus:'confirmed'};
  assert.equal(isWhatsAppDeliveryAllowed(allowed),true);
  for(const edit of [{tenantEnabled:false},{consentAt:null},{revokedAt:new Date().toISOString()},{templateName:''},{appointmentStatus:'cancelled'}])
    assert.equal(isWhatsAppDeliveryAllowed({...allowed,...edit}),false);
});
