import test from 'node:test';
import assert from 'node:assert/strict';
import { configFromEnv } from '../src/config.js';
import { endOfBooking } from '../src/routes.js';
import { buildApp } from '../src/app.js';
test('production requires credentials',()=>{
  assert.throws(()=>configFromEnv({NODE_ENV:'production'}),/Production requires/);
});
test('booking duration and invalid duration',()=>{
  const start='2030-01-01T11:00:00.000Z';
  const now=Date.parse('2029-12-31T11:00:00Z');
  assert.equal(endOfBooking(start,30,now),'2030-01-01T11:30:00.000Z');
  assert.throws(()=>endOfBooking(start,0,now));
});
test('health live is public; ready refuses missing backing services',async()=>{
  const app=await buildApp({NODE_ENV:'development',CORS_ORIGINS:'http://localhost:3000',LOG_LEVEL:'silent'});
  try {
    assert.equal((await app.inject('/api/v1/health/live')).statusCode,200);
    assert.equal((await app.inject('/api/v1/health/ready')).statusCode,503);
    assert.equal((await app.inject('/api/v1/tenants')).statusCode,503);
  } finally { await app.close(); }
});
test('cannot create booking with unconfigured auth',async()=>{
  const app=await buildApp({NODE_ENV:'development',LOG_LEVEL:'silent'});
  try {
    const res=await app.inject({method:'POST',url:'/api/v1/tenants/00000000-0000-4000-a000-000000000000/bookings',payload:{}});
    assert.equal(res.statusCode,503);
  } finally { await app.close(); }
});
