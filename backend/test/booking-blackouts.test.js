import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {validateBlackouts,validateBlackoutEdit,dayIso,registerBookingBlackoutRoutes} from '../src/booking-blackouts.js';

const tenant='11111111-1111-4111-8111-111111111111';
const owner='22222222-2222-4222-8222-222222222222';
const day=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
const plus=(n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);

test('booking blackout validates dates, rejects intersections and allows separated ranges',()=>{
 assert.deepEqual(validateBlackouts([{from:day,to:day},{from:plus(3),to:plus(5)}]),[{from:day,to:day},{from:plus(3),to:plus(5)}]);
 assert.throws(()=>validateBlackouts([{from:day,to:plus(2)},{from:plus(2),to:plus(3)}]),/superponerse/i);
 assert.throws(()=>validateBlackouts([{from:plus(3),to:day}]),/fechas/i);
 assert.throws(()=>validateBlackouts([{from:'2020-01-01',to:'2020-01-02'}]),/fechas/i);
});

test('active blackout can be extended without changing its past start date',()=>{
 const today=dayIso(new Date());
 const before=new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10);
 const after=new Date(Date.parse(today+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 assert.deepEqual(validateBlackoutEdit({from:before,to:after},{from:before,to:today},today),{from:before,to:after});
 assert.throws(()=>validateBlackoutEdit({from:before,to:after},{from:today,to:after},today),/períodos/);
 assert.throws(()=>validateBlackoutEdit({from:before,to:today},{from:before,to:before},today),/períodos/);
});

test('authorized owner can schedule, edit and delete closures without changing existing appointments',async()=>{
 const app=Fastify({logger:false});
 const rows=[];const queries=[];
 const db={transaction:async fn=>fn(db),query:async(sql,args=[])=>{
  queries.push(sql);
  if(sql.includes('pg_advisory_xact_lock'))return {rowCount:1,rows:[{}]};
  if(sql.includes('SELECT time_zone FROM public.tenants'))return {rowCount:1,rows:[{time_zone:'America/Bogota'}]};
  if(sql.includes('SELECT 1 FROM public.tenant_booking_blackouts')){
   const overlapping=rows.find(x=>(args.length!==4||x.id!==args[1])&&x.from<=args.at(-1)&&x.to>=args.at(-2));
   return {rowCount:Number(!!overlapping),rows:overlapping?[overlapping]:[]};
  }
  if(sql.includes('INSERT INTO public.tenant_booking_blackouts')){
   const value={id:`${String(rows.length+1).padStart(8,'0')}-0000-4000-8000-000000000000`,from:args[1],to:args[2],reason:''};
   rows.push(value);return {rowCount:1,rows:[value]};
  }
  if(sql.includes('SELECT start_date::text AS "from",end_date::text AS "to"')){
    const matched=rows.find(x=>x.id===args[1]);return {rowCount:Number(!!matched),rows:matched?[matched]:[]};
  }
  if(sql.includes('UPDATE public.tenant_booking_blackouts')){
    const matched=rows.find(x=>x.id===args[1]);
    if(!matched)return {rowCount:0,rows:[]};
    matched.from=args[2];matched.to=args[3];return {rowCount:1,rows:[matched]};
  }
  if(sql.includes('SELECT id,start_date::text'))return {rowCount:rows.length,rows:[...rows]};
  if(sql.includes('DELETE FROM public.tenant_booking_blackouts')){
   const idx=rows.findIndex(x=>x.id===args[1]);return idx<0?{rowCount:0,rows:[]}:{rowCount:1,rows:rows.splice(idx,1)};
  }
  throw Error('Unexpected SQL: '+sql);
 }};
 const security={authenticated:async req=>{req.actor={id:req.headers['x-role']==='barber'?'barber':owner};},limited:async()=>{},requireTenant:async(_db,_tid,_uid,roles)=>{
  if(roles&&_uid==='barber'){const err=Error('No autorizado');err.statusCode=403;throw err;}
 }};
 app.setErrorHandler((error,req,reply)=>reply.code(error.statusCode||500).send({error:error.message}));
 await registerBookingBlackoutRoutes(app,{db,security});
 const url='/api/v1/tenants/'+tenant+'/booking-blackouts';
 try{
  const denied=await app.inject({method:'POST',url,headers:{'x-role':'barber'},payload:{periods:[{from:day,to:day}]}});
  assert.equal(denied.statusCode,403);
  const added=await app.inject({method:'POST',url,payload:{periods:[{from:day,to:day},{from:plus(2),to:plus(3)}]}});
  assert.equal(added.statusCode,201,added.payload);
  assert.equal(rows.length,2);
  const overlap=await app.inject({method:'POST',url,payload:{periods:[{from:day,to:day}]}});
  assert.equal(overlap.statusCode,409);
  const read=await app.inject({method:'GET',url});assert.equal(read.statusCode,200);assert.equal(read.json().length,2);
  const editId=rows[0].id;
  const deniedEdit=await app.inject({method:'PATCH',url:url+'/'+editId,
    headers:{'x-role':'barber'},payload:{from:day,to:plus(1)}});
  assert.equal(deniedEdit.statusCode,403);
  const edited=await app.inject({method:'PATCH',url:url+'/'+editId,
    payload:{from:day,to:plus(1)}});
  assert.equal(edited.statusCode,200,edited.payload);
  assert.equal(edited.json().to,plus(1));
  const invalidOverlap=await app.inject({method:'PATCH',url:url+'/'+editId,
    payload:{from:day,to:plus(2)}});
  assert.equal(invalidOverlap.statusCode,409);
  assert.equal(rows[0].to,plus(1),'Rejected overlap must not mutate the saved period');
  const removed=await app.inject({method:'DELETE',url:url+'/'+rows[0].id});assert.equal(removed.statusCode,200);
  assert.equal(rows.length,1);
  assert.ok(!queries.some(sql=>/UPDATE public.appointments|DELETE FROM public.appointments|UPDATE public.tenants SET opening_hours/.test(sql)),
   'Scheduling must never modify appointments or normal hours');
 }finally{await app.close();}
});