import test from 'node:test';
import assert from 'node:assert/strict';
import {processWhatsAppJobs} from '../src/whatsapp-dispatch.js';

test('legacy queued WhatsApp notices with an 11-digit Colombian cellphone are suppressed before Meta',async()=>{
 const job={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  phone_e164:'+5731831018597',event_kind:'reminder',event_version:0};
 const changes=[];
 let fetched=false,claimed=false;
 const db={
  transaction:async callback=>callback(db),
  query:async(sql,args=[])=>{
   if(sql.includes("status='manual_review'"))return {rowCount:0,rows:[]};
   if(sql.includes("SELECT * FROM public.whatsapp_messages WHERE status='queued'")){
    if(fetched)return {rowCount:0,rows:[]};
    fetched=true;return {rowCount:1,rows:[job]};
   }
   if(sql.includes("SET status='sending'")){claimed=true;return {rowCount:1,rows:[]};}
   if(sql.includes('SET status=$2')){changes.push(args);return {rowCount:1,rows:[]};}
   throw Error('Unexpected query: '+sql);
  }
 };
 const result=await processWhatsAppJobs({
  db,
  config:{whatsappSendEnabled:true,whatsappAccessToken:'fake',
    whatsappPhoneNumberId:'1234567890',whatsappGraphVersion:'v23.0'},
  fetcher:async()=>{throw Error('Meta should not receive an invalid number');},
  maxBatch:1,
 });
 assert.equal(claimed,true);
 assert.equal(result.attempted,1);
 assert.deepEqual(changes.map(x=>({status:x[1],code:x[2]})),
  [{status:'suppressed',code:'invalid_recipient'}]);
});
