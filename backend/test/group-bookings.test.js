import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {validateGroupCollisions,registerGroupBookingRoutes} from '../src/group-bookings.js';

const tenant='11111111-1111-4111-8111-111111111111';
const barber='22222222-2222-4222-8222-222222222222';

test('a barber cannot be double booked in a multi-person reservation',()=>{
  const at='2026-11-20T13:00:00.000Z';
  const next='2026-11-20T13:15:00.000Z';
  assert.throws(()=>validateGroupCollisions([
    {barberId:barber,startsAt:at,endsAt:'2026-11-20T13:30:00.000Z'},
    {barberId:barber,startsAt:next,endsAt:'2026-11-20T13:45:00.000Z'}
  ]),/no puede atender dos personas/i);
  assert.doesNotThrow(()=>validateGroupCollisions([
    {barberId:barber,startsAt:at,endsAt:'2026-11-20T13:30:00.000Z'},
    {barberId:barber,startsAt:'2026-11-20T13:30:00.000Z',endsAt:'2026-11-20T14:00:00.000Z'}
  ]));
  assert.doesNotThrow(()=>validateGroupCollisions([
    {barberId:barber,startsAt:at,endsAt:'2026-11-20T13:30:00.000Z'},
    {barberId:'33333333-3333-4333-8333-333333333333',startsAt:at,endsAt:'2026-11-20T13:30:00.000Z'}
  ]));
});

test('the booking pause is owner controlled and status is public',async()=>{
  const app=Fastify({logger:false});
  let accepting=true,authorized=true;
  const db={
    query:async(sql,args)=>{
      if(sql.includes('SELECT accepting_bookings FROM public.tenants'))return {rowCount:1,rows:[{accepting_bookings:accepting}]};
      if(sql.includes('pg_advisory_xact_lock'))return {rowCount:1,rows:[{}]};
      if(sql.includes('UPDATE public.tenants SET accepting_bookings=')){
        accepting=args[1];return {rowCount:1,rows:[{accepting_bookings:accepting}]};
      }
      throw Error('Unexpected SQL: '+sql);
    },
    transaction:async handler=>handler(db)
  };
  const security={
    authenticated:async req=>{req.actor={id:'44444444-4444-4444-8444-444444444444'};},
    limited:async()=>{},
    requireTenant:async()=>{if(!authorized){const e=Error('Sin permiso');e.statusCode=403;throw e;}}
  };
  app.setErrorHandler((error,req,reply)=>reply.code(error.statusCode||500).send({error:error.message}));
  await registerGroupBookingRoutes(app,{db,security});
  try{
    let response=await app.inject({url:'/api/v1/public/tenants/'+tenant+'/booking-status'});
    assert.equal(response.statusCode,200);
    assert.equal(response.json().acceptingBookings,true);
    authorized=false;
    response=await app.inject({method:'PATCH',url:'/api/v1/tenants/'+tenant+'/booking-status',payload:{acceptingBookings:false}});
    assert.equal(response.statusCode,403);
    assert.equal(accepting,true);
    authorized=true;
    response=await app.inject({method:'PATCH',url:'/api/v1/tenants/'+tenant+'/booking-status',payload:{acceptingBookings:false}});
    assert.equal(response.statusCode,200);
    assert.equal(response.json().acceptingBookings,false);
    response=await app.inject({url:'/api/v1/public/tenants/'+tenant+'/booking-status'});
    assert.equal(response.json().acceptingBookings,false);
  }finally{await app.close();}
});