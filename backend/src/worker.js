import Redis from 'ioredis';
import { configFromEnv } from './config.js';
import { createDb } from './db.js';
import { processWhatsAppJobs } from './whatsapp-dispatch.js';
import {resolveWhatsAppIntegration} from './integration-secrets.js';
const config=configFromEnv(process.env);
if(!config.databaseUrl || !config.redisUrl) throw new Error('Worker requires DATABASE_URL and REDIS_URL');
const db=createDb(config);
const redis=new Redis(config.redisUrl,{maxRetriesPerRequest:1,connectTimeout:3000});
redis.on('error',()=>{});
let running=true;
let ticks=0;
let idleCycles=0;
let failedCycles=0;
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
    return rows.length;
  });
}
for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>{running=false;});
try {
  while(running) {
    let delay=1500;
    try {
      const found=await deliverBatch();
      let whatsappAttempts=0;
      if(config.whatsappSendEnabled){
        const runtime=await resolveWhatsAppIntegration(db,config);
        if(runtime.whatsappSendEnabled){
          const result=await processWhatsAppJobs({db,config:runtime});
          whatsappAttempts=result.attempted||0;
        }
      }
      failedCycles=0;
      idleCycles=found===0&&whatsappAttempts===0?Math.min(4,idleCycles+1):0;
      delay=idleCycles===0?500:Math.min(5000,1500+idleCycles*875);
      if(++ticks%600===0){
        // 30-day retention; bounded deletion avoids excessive database work.
        await db.query("WITH expired AS (SELECT id FROM public.outbox_events WHERE processed_at<now()-interval '30 days' ORDER BY processed_at LIMIT 500) DELETE FROM public.outbox_events e USING expired x WHERE e.id=x.id");
      }
    } catch(error) {
      failedCycles=Math.min(5,failedCycles+1);
      delay=Math.min(15000,1500*Math.pow(2,failedCycles));
      console.error('Outbox worker error:',error.message);
    }
    if(running) await sleep(delay);
  }
} finally { redis.disconnect(); await db.close(); }
