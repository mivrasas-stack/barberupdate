import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import Fastify from 'fastify';
import {registerLiveEventRoutes} from '../src/live-events.js';

function fakeRedis(){
 const emitters=new Set();
 const state={published:[]};
 const publisher={
  duplicate(){
   const listener=new EventEmitter();
   listener.connect=async()=>{};
   listener.subscribe=async()=>{emitters.add(listener)};
   listener.quit=async()=>{emitters.delete(listener)};
   listener.disconnect=()=>{emitters.delete(listener)};
   return listener;
  },
  async publish(channel,payload){
   state.published.push({channel,payload});
   for(const listener of emitters)listener.emit('message',channel,payload);
   return emitters.size;
  }
 };
 return {publisher,state};
}
const auth={
 authenticated:async req=>{if(!req.headers.authorization?.startsWith('Bearer test-'))throw Object.assign(new Error('Forbidden'),{statusCode:401});},
 limited:async()=>{}
};
test('realtime endpoint is unauthorized without the same bearer authentication as REST',async()=>{
 const {publisher}=fakeRedis();
 const app=Fastify();
 try{
  await registerLiveEventRoutes(app,{security:{...auth,redis:publisher}});
  const r=await app.inject('/api/v1/live/events');
  assert.equal(r.statusCode,401);
 }finally{await app.close();}
});
test('writes publish a data-free change event across API replicas, and reads do not',async()=>{
 const {publisher,state}=fakeRedis();
 const server1=Fastify(),server2=Fastify();
 try{
  await registerLiveEventRoutes(server1,{security:{...auth,redis:publisher}});
  await registerLiveEventRoutes(server2,{security:{...auth,redis:publisher}});
  server1.post('/api/v1/tenants/demo/create',async()=>({ok:true,customerName:'Must not be sent in events'}));
  server1.get('/api/v1/tenants/demo/read',async()=>({ok:true}));
  await server1.listen({host:'127.0.0.1',port:0});
  await server2.listen({host:'127.0.0.1',port:0});
  const base2=server2.listeningOrigin,base1=server1.listeningOrigin;
  const controller=new AbortController();
  const stream=await fetch(base2+'/api/v1/live/events',{headers:{Authorization:'Bearer test-user'},signal:controller.signal});
  assert.equal(stream.status,200);
  assert.match(stream.headers.get('content-type'),/text\/event-stream/);
  const reader=stream.body.getReader();
  const initial=await reader.read();
  assert.match(new TextDecoder().decode(initial.value),/connected/);
  await fetch(base1+'/api/v1/tenants/demo/read');
  assert.equal(state.published.length,0);
  await fetch(base1+'/api/v1/tenants/demo/create',{method:'POST'});
  // Wait only for the broadcaster's async onResponse Redis publish.
  for(let i=0;i<30&&state.published.length===0;i++)await new Promise(r=>setTimeout(r,20));
  assert.equal(state.published.length,1);
  assert.equal(state.published[0].payload,'changed');
  assert.equal(JSON.stringify(state.published).includes('customerName'),false);
  const next=await Promise.race([reader.read(),new Promise((_,reject)=>setTimeout(()=>reject(Error('SSE event missing')),1500))]);
  assert.match(new TextDecoder().decode(next.value),/event: changed/);
  assert.doesNotMatch(new TextDecoder().decode(next.value),/customerName/);
  controller.abort();
 }finally{
  await Promise.all([server1.close(),server2.close()]);
 }
});