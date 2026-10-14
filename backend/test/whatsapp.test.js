import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePhone,localDateTime,templateParams,sendWhatsappTemplate,TEMPLATES} from '../src/whatsapp.js';
test('Template names are exact',()=>assert.deepEqual(Object.values(TEMPLATES),
 ['confirmacion_de_reserva','nueva_cita_barbero','cita_cancelada','recordatorio_cita_cliente']));
test('Phones and local Bogota time',()=>{
 assert.equal(normalizePhone('+57 300 123 4567'),'573001234567');
 assert.equal(normalizePhone('abc'),null);
 assert.equal(localDateTime('2026-10-23T20:00:00Z','America/Bogota').date,'23/10/2026');
});
test('Templates use only expected body parameters',()=>{
 const row={starts_at:'2026-10-23T20:00:00Z',time_zone:'America/Bogota',customer_name:'Juan',shop_name:'Barber Motas',barber_name:'Carlos'};
 assert.equal(templateParams('confirmation',row).length,5);
 assert.equal(templateParams('barber_new',row).length,4);
 assert.equal(templateParams('cancellation',row).length,2);
 assert.equal(templateParams('reminder',row).length,4);
});
test('Send uses authorized Meta template endpoint without webhooks',async()=>{
 let outbound;
 const fake=async(url,options)=>{outbound={url,options};return {ok:true,json:async()=>({messages:[{id:'wamid.test'}]})};};
 const result=await sendWhatsappTemplate({whatsappAccessToken:'test-token',whatsappPhoneNumberId:'123456',whatsappGraphVersion:'v23.0',whatsappLanguage:'es'},
 {to:'+57 300 1234567',kind:'confirmation',params:['Juan','Barber Motas','23/10/2026','3:00 p. m.','Carlos']},fake);
 assert.equal(result,'wamid.test');
 assert.equal(outbound.url,'https://graph.facebook.com/v23.0/123456/messages');
 assert.equal(JSON.parse(outbound.options.body).template.name,'confirmacion_de_reserva');
});
