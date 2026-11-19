import test from 'node:test';
import assert from 'node:assert/strict';
import {followLiveUpdates} from '../../src/services/liveUpdates';

test('authorized SSE invalidations refresh data; heartbeat does not',async()=>{
 const controller=new AbortController();
 const encoder=new TextEncoder();
 let calls=0,tokenCalls=0;
 const stream=new ReadableStream<Uint8Array>({
  start(sink){
   sink.enqueue(encoder.encode(': connected\n\n: heartbeat\n\nevent: changed\ndata: {}\n\n'));
  }
 });
 const fetcher=async(_url:string,opts?:RequestInit)=>{
  assert.equal(new Headers(opts?.headers).get('Authorization'),'Bearer fake-test-token');
  return {ok:true,body:stream,status:200} as Response;
 };
 followLiveUpdates('/api/v1/live/events',async()=>{
  tokenCalls++;return 'fake-test-token';
 },()=>{
  calls++;controller.abort();
 },controller.signal,fetcher as typeof fetch);
 for(let n=0;n<35&&calls===0;n++)await new Promise(r=>setTimeout(r,10));
 assert.equal(calls,1);
 assert.equal(tokenCalls,1);
});