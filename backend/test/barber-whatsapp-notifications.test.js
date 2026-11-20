import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerBarberWhatsAppRoutes} from '../src/barber-whatsapp.js';
import {processWhatsAppJobs} from '../src/whatsapp-dispatch.js';

const tenant='11111111-1111-4111-8111-111111111111';
const barber='22222222-2222-4222-8222-222222222222';
const staff='33333333-3333-4333-8333-333333333333';
const appointment='44444444-4444-4444-8444-444444444444';
const message='55555555-5555-4555-8555-555555555555';
const customer='66666666-6666-4666-8666-666666666666';
const url='/api/v1/tenants/'+tenant+'/barbers/'+barber+'/whatsapp-notifications';

test('only the linked professional can explicitly opt into WhatsApp; invalid phone rejected and disabling suppresses only staff jobs',async()=>{
 const app=Fastify({logger:false});
 const record={user_id:staff,whatsapp_phone:'',whatsapp_opt_in:false};
 const changes=[];
 const db={transaction:async cb=>cb(db),query:async(sql,args=[])=>{
  changes.push({sql,args});
  if(sql.includes('SELECT id,user_id,whatsapp_phone,whatsapp_opt_in,status FROM public.barbers'))
   return {rows:[{...record}],rowCount:1};
  if(sql.includes("SELECT enabled,templates->'barber_created'")){
   return {rowCount:1,rows:[{enabled:true,template_name:null}]};
  }
  if(sql.includes('pg_advisory_xact_lock'))return {rowCount:1,rows:[]};
  if(sql.includes('UPDATE public.barbers SET whatsapp_phone=')){
   record.whatsapp_phone=args[2];record.whatsapp_opt_in=args[3];
   return {rows:[{id:barber}],rowCount:1};
  }
  if(sql.includes('UPDATE public.whatsapp_messages m SET status='))return {rows:[],rowCount:0};
  throw Error('Unexpected SQL: '+sql);
 }};
 const security={authenticated:async req=>{req.actor={id:req.headers['x-actor']||staff};},limited:async()=>{},
  requireTenant:async()=>{}};
 app.setErrorHandler((e,req,reply)=>reply.code(e.statusCode||500).send({error:e.message}));
 await registerBarberWhatsAppRoutes(app,{db,security});
 try{
  let r=await app.inject({method:'GET',url,headers:{'x-actor':customer}});
  assert.equal(r.statusCode,403);
  r=await app.inject({method:'PATCH',url,headers:{'x-actor':customer},payload:{enabled:true,phone:'3001234567'}});
  assert.equal(r.statusCode,403);assert.equal(changes.filter(v=>v.sql.includes('UPDATE public.barbers')).length,0);
  r=await app.inject({method:'PATCH',url,payload:{enabled:true,phone:'30012345678'}});
  assert.equal(r.statusCode,400);
  r=await app.inject({method:'PATCH',url,payload:{enabled:true,phone:'3001234567'}});
  assert.equal(r.statusCode,200,r.body);
  assert.equal(record.whatsapp_phone,'+573001234567');assert.equal(record.whatsapp_opt_in,true);
  r=await app.inject({method:'GET',url});
  assert.equal(r.json().enabled,true);
  r=await app.inject({method:'PATCH',url,payload:{enabled:false,phone:''}});
  assert.equal(r.statusCode,200,r.body);assert.equal(record.whatsapp_opt_in,false);
  assert.equal(changes.filter(v=>v.sql.includes('UPDATE public.whatsapp_messages m SET status=')).length,2,
    'Changing the opted-in number and opting out should suppress only pending staff events');
 }finally{await app.close()}
});

function mockedDelivery({opted=true,phone='+573001234567',staffUser=staff}={}){
 let taken=false,posted=[],states=[];
 const job={id:message,tenant_id:tenant,appointment_id:appointment,user_id:staff,
   phone_e164:'+573001234567',event_kind:'barber_created',event_version:0};
 const db={transaction:async cb=>cb(db),query:async(sql,args=[])=>{
  if(sql.includes("UPDATE public.whatsapp_messages SET status='manual_review'"))return {rows:[],rowCount:0};
  if(sql.includes("SELECT * FROM public.whatsapp_messages WHERE status='queued'")){
   if(taken)return {rows:[],rowCount:0};
   taken=true;return {rows:[job],rowCount:1};
  }
  if(sql.includes('UPDATE public.whatsapp_messages SET status=')){
   if(args.length>2&&typeof args[1]==='string')states.push({status:args[1],reason:args[2]});
   return {rows:[],rowCount:1};
  }
  if(sql.includes('SELECT a.customer_name,a.customer_phone')){
   const record={customer_name:'Cliente QA',customer_phone:'+573009998888',
    starts_at:new Date(Date.now()+86400000),status:'confirmed',reschedule_count:0,
    business_name:'Barbería QA',time_zone:'America/Bogota',service_name:'Corte',barber_name:'Barbero QA',
    barber_user_id:staffUser,barber_whatsapp_phone:phone,barber_whatsapp_opt_in:opted,barber_status:'active',
    enabled:true,language_code:'es',templates:{barber_created:{name:'barbernow_nueva_cita_barbero_util_v1',
    params:['barber_name','business_name','customer_name','service_name','date','time']}},
    consented_at:null,revoked_at:null};
   return {rows:[{...record}],rowCount:1};
  }
  throw Error('Unexpected SQL: '+sql);
 }};
 const fetcher=async(url,options)=>{
  posted.push(JSON.parse(options.body));
  return {ok:true,json:async()=>({messages:[{id:'wamid.synthetic'}]})};
 };
 return {db,posted,states,fetcher};
}
test('staff booking template sends only to opted-in barber, using barber number instead of customer number',async()=>{
 const fixture=mockedDelivery();
 const result=await processWhatsAppJobs({
  db:fixture.db,config:{whatsappSendEnabled:true,whatsappAccessToken:'fake-test-token',
   whatsappPhoneNumberId:'123456789',whatsappGraphVersion:'v23.0'},
  maxBatch:1,fetcher:fixture.fetcher});
 assert.equal(result.attempted,1);
 assert.equal(fixture.posted.length,1);
 assert.equal(fixture.posted[0].to,'573001234567');
 assert.equal(fixture.posted[0].template.name,'barbernow_nueva_cita_barbero_util_v1');
 assert.deepEqual(fixture.posted[0].template.components[0].parameters.slice(0,4).map(x=>x.text),
   ['Barbero QA','Barbería QA','Cliente QA','Corte']);
 assert.ok(fixture.states.some(x=>x.status==='sent'));
});

test('unsubscribed staff member or changed phone never receives a booking notification',async()=>{
 for(const cfg of [{opted:false},{phone:'+573004445555'},{staffUser:customer}]){
  const fixture=mockedDelivery(cfg);
  await processWhatsAppJobs({db:fixture.db,config:{
   whatsappSendEnabled:true,whatsappAccessToken:'fake-test-token',
   whatsappPhoneNumberId:'123456789',whatsappGraphVersion:'v23.0'},
   maxBatch:1,fetcher:fixture.fetcher});
  assert.equal(fixture.posted.length,0);
  assert.ok(fixture.states.some(x=>x.status==='suppressed'));
 }
});