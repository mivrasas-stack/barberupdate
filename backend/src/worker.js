import Redis from 'ioredis';
import { configFromEnv } from './config.js';
import { createDb } from './db.js';
const config=configFromEnv(process.env);
if(!config.databaseUrl || !config.redisUrl) throw new Error('Worker requires DATABASE_URL and REDIS_URL');
const db=createDb(config);
const redis=new Redis(config.redisUrl,{maxRetriesPerRequest:1,connectTimeout:3000});
redis.on('error',()=>{});
let running=true;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function deliverBatch() {
  await db.transaction(async tx=>{
    const {rows}=await tx.query("SELECT id,tenant_id,topic,payload,attempts FROM public.outbox_events WHERE processed_at IS NULL AND next_attempt_at<=now() AND attempts<12 ORDER BY next_attempt_at,id LIMIT 25 FOR UPDATE SKIP LOCKED");
    for(const event of rows) {
      try {
        await redis.publish('barberos:events:'+event.tenant_id,JSON.stringify({eventId:event.id,topic:event.topic,payload:event.payload}));
        await tx.query('UPDATE public.outbox_events SET processed_at=now(),attempts=attempts+1 WHERE id=$1',[event.id]);
      } catch (err) {
        const backoff=Math.min(3600,Math.pow(2,Math.min(12,event.attempts))*5);
        await tx.query("UPDATE public.outbox_events SET attempts=attempts+1,next_attempt_at=now()+($2::int * interval '1 second') WHERE id=$1",[event.id,backoff]);
      }
    }
  });
}
for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>{running=false;});
try {
  while(running) {
    try { await deliverBatch(); } catch(error) { console.error('Outbox worker error:',error.message); }
    if(running) await sleep(1500);
  }
} finally { redis.disconnect(); await db.close(); }
