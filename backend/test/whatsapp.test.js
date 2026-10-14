import test from 'node:test';
import assert from 'node:assert/strict';
import {sendBookingConfirmation,normalizePhone} from '../src/whatsapp.js';

const settings={enabled:true,accessToken:'fake-only-for-test',phoneNumberId:'12345',graphVersion:'v23.0',templateName:'barberos_booking_confirmation',templateLanguage:'es'};
const appointment={customer_name:'Ana',customer_phone:'+57 300 123 4567',shop_name:'Barberia Centro',time_zone:'America/Bogota',starts_at:'2026-11-02T15:00:00Z'};
test('formats approved booking confirmation template without exposing token in payload',async()=>{
  let args;
  const result=await sendBookingConfirmation(settings,appointment,async(...a)=>{
    args=a;
    return {ok:true,json:async()=>({messages:[{id:'wamid.test'}]})};
  });
  assert.equal(result.messageId,'wamid.test');
  assert.equal(args[0],'https://graph.facebook.com/v23.0/12345/messages');
  const data=JSON.parse(args[1].body);
  assert.equal(data.to,'573001234567');
  assert.equal(data.type,'template');
  assert.deepEqual(data.template.components[0].parameters.map(x=>x.text),['Ana','Barberia Centro','2 de noviembre de 2026','10:00 a. m.']);
  assert.ok(!args[1].body.includes(settings.accessToken));
});
test('disabled sending never contacts Meta',async()=>{
  const value=await sendBookingConfirmation({...settings,enabled:false},appointment,()=>{throw Error('called');});
  assert.deepEqual(value,{skipped:true});
});
test('rejects invalid phone and surfaces API failures without secrets',async()=>{
  assert.throws(()=>normalizePhone('abc'));
  await assert.rejects(sendBookingConfirmation(settings,appointment,async()=>({ok:false,status:401})),/HTTP 401/);
});
