import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

test('Fastify trusts only a single Caddy hop for client IP',async()=>{
  const app=Fastify({trustProxy:(_address,hop)=>hop===0,logger:false});
  app.get('/ip',async req=>({ip:req.ip}));
  try{
    const legitimate=await app.inject({
      method:'GET',url:'/ip',remoteAddress:'172.24.0.3',
      headers:{'x-forwarded-for':'203.0.113.21'}
    });
    assert.equal(legitimate.json().ip,'203.0.113.21');
    const spoofed=await app.inject({
      method:'GET',url:'/ip',remoteAddress:'172.24.0.3',
      headers:{'x-forwarded-for':'8.8.8.8, 203.0.113.21'}
    });
    assert.equal(spoofed.json().ip,'203.0.113.21',
      'The left-hand untrusted hop cannot change the effective client IP');
    const direct=await app.inject({method:'GET',url:'/ip',
      remoteAddress:'10.1.1.55'});
    assert.equal(direct.json().ip,'10.1.1.55');
  }finally{await app.close();}
});
