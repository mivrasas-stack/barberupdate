import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMonitorBase,probeBarberOS} from '../scripts/health-monitor.mjs';

const reply=(status,body)=>({status,async json(){return body;}});

test('monitor refuses HTTP to remote servers and credential-bearing URLs',()=>{
  assert.equal(validateMonitorBase('http://127.0.0.1:8188'),'http://127.0.0.1:8188');
  assert.equal(validateMonitorBase('https://api.example.org'),'https://api.example.org');
  assert.throws(()=>validateMonitorBase('http://api.example.org'),/HTTPS/);
  assert.throws(()=>validateMonitorBase('https://user:pass@api.example.org'),/credentials/);
});
test('monitor reports all checks healthy only for ready API with disabled Wompi',async()=>{
  const result=await probeBarberOS({fetchImpl:async url=>{
    if(url.endsWith('/health/ready'))return reply(200,{status:'ready'});
    if(url.endsWith('/public/plans'))return reply(200,[{id:1}]);
    return reply(200,{onlinePayments:{enabled:false},platformBilling:{providerSelected:'wompi',enabled:false}});
  }});
  assert.equal(result.healthy,true);
  assert.equal(result.checks.length,3);
});
test('monitor fails closed for unavailable database or unexpectedly enabled Wompi',async()=>{
  const result=await probeBarberOS({fetchImpl:async url=>{
    if(url.endsWith('/health/ready'))return reply(503,{status:'unavailable'});
    if(url.endsWith('/public/plans'))return reply(200,[]);
    return reply(200,{onlinePayments:{enabled:true},platformBilling:{providerSelected:'wompi',enabled:true}});
  }});
  assert.equal(result.healthy,false);
  assert.equal(result.checks.filter(c=>!c.ok).length,3);
});
