import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerRoutes} from '../src/routes.js';
import {describeApiError} from '../src/app.js';

const tenant='11111111-1111-4111-8111-111111111111';
const barber='22222222-2222-4222-8222-222222222222';
const service='33333333-3333-4333-8333-333333333333';
const customer='44444444-4444-4444-8444-444444444444';
const appointment='55555555-5555-4555-8555-555555555555';

test('a new customer booking is automatically confirmed and idempotent without staff approval',async()=>{
 const app=Fastify({logger:false});
 const rows=[];
 const queries=[];
 const db={
  transaction:async run=>run(db),
  query:async(sql,args=[])=>{
   queries.push({sql,args});
   if(sql.includes('pg_advisory_xact_lock'))return {rowCount:1,rows:[{}]};
   if(sql.includes('SELECT tenant_id,barber_id FROM public.customer_links WHERE user_id='))
    return {rowCount:1,rows:[{tenant_id:tenant,barber_id:barber}]};
   if(sql.includes('SELECT opening_hours,time_zone FROM public.tenants'))
    return {rowCount:1,rows:[{opening_hours:{days:'Todos los días',open:'00:00',close:'23:59'},time_zone:'America/Bogota'}]};
   if(sql.includes('SELECT duration_minutes FROM public.services'))
    return {rowCount:1,rows:[{duration_minutes:30}]};
   if(sql.includes('INSERT INTO public.whatsapp_consents'))
    return {rowCount:1,rows:[]};
   if(sql.includes('SELECT * FROM public.appointments WHERE tenant_id='))
    return {rowCount:rows.length,rows:[...rows]};
   if(sql.includes('INSERT INTO public.appointments')){
    assert.match(sql,/request_hash,status\)/,'Status must be explicit in the INSERT');
    assert.match(sql,/\$10,'confirmed' FROM public.services/,'New reservations must be confirmed without staff intervention');
    const item={id:appointment,tenant_id:tenant,barber_id:barber,service_id:service,
      status:'confirmed',request_hash:'',customer_name:'Cliente QR'};
    rows.push(item);
    return {rowCount:1,rows:[item]};
   }
   throw Error('Unexpected SQL: '+sql);
  }
 };
 const security={authenticated:async req=>{req.actor={id:customer};},limited:async()=>{},requireTenant:async()=>{}};
 app.setErrorHandler((err,req,reply)=>{
  const {status,message}=describeApiError(err);
  reply.code(status).send({error:message});
 });
 await registerRoutes(app,{db,security,config:{}});
 await app.ready();
 try{
  const payload={barberId:barber,serviceId:service,
   startsAt:new Date(Date.now()+60*60*1000).toISOString(),
   customerName:'Cliente QR',customerPhone:'3001112233',whatsappOptIn:true};
  const options={method:'POST',url:'/api/v1/tenants/'+tenant+'/bookings',
   headers:{'Idempotency-Key':'auto-confirm-test-2026'},payload};
  const crossTenant=await app.inject({...options,url:'/api/v1/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bookings',headers:{'Idempotency-Key':'qr-block-tenant-test'}});
  assert.equal(crossTenant.statusCode,403,'QR linked customer must not book another tenant');
  const wrongBarber=await app.inject({...options,payload:{...payload,barberId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},headers:{'Idempotency-Key':'qr-block-barber-test'}});
  assert.equal(wrongBarber.statusCode,403,'Professional QR must not book a different barber');
  assert.equal(rows.length,0,'Rejected requests must not create bookings');
  assert.equal(queries.filter(q=>q.sql.includes('INSERT INTO public.whatsapp_consents')).length,0,
    'Cross-tenant and cross-barber requests cannot authorize WhatsApp');
  const invalid=await app.inject({...options,payload:{...payload,customerPhone:'30011122339'},headers:{'Idempotency-Key':'whatsapp-phone-local-test'}});
  assert.equal(invalid.statusCode,400,'A Colombian number with 11 digits must be rejected instead of adding +57');
  assert.match(invalid.json().error,/10 dígitos/i);
  const wrongInternational=await app.inject({...options,payload:{...payload,customerPhone:'+5730011122339'},headers:{'Idempotency-Key':'invalid-colombian-prefix-test'}});
  assert.equal(wrongInternational.statusCode,400,'An invalid +57 number must not reach Meta');
  const first=await app.inject(options);
  assert.equal(first.statusCode,201,first.body);
  assert.equal(first.json().status,'confirmed');
  assert.equal(rows.length,1);
  const consentIndex=queries.findIndex(q=>q.sql.includes('INSERT INTO public.whatsapp_consents'));
  const appointmentIndex=queries.findIndex(q=>q.sql.includes('INSERT INTO public.appointments'));
  assert.ok(consentIndex>=0&&consentIndex<appointmentIndex,'Opt-in must be persisted before the appointment trigger queues messages');
  assert.deepEqual(queries[consentIndex].args,[tenant,customer,'+573001112233']);
  assert.equal(queries[appointmentIndex].args[5],'+573001112233','The booking and consent must share the exact E.164 phone');
  const replay=await app.inject({...options,payload:{...payload,customerPhone:'+573001112233'}});
  assert.equal(replay.statusCode,200,replay.body);
  assert.equal(replay.json().status,'confirmed');
  assert.equal(rows.length,1,'Retry must not create or approve a second appointment');
  assert.equal(queries.filter(q=>q.sql.includes('INSERT INTO public.appointments')).length,1);
  assert.equal(queries.filter(q=>q.sql.includes('INSERT INTO public.whatsapp_consents')).length,1,
    'Idempotent retry cannot opt in or queue a duplicate booking');
 }finally{await app.close();}
});
