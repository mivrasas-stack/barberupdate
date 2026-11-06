import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {createLocalWhatsAppOtp} from '../src/local-whatsapp-otp.js';
import {createWhatsAppAuthMessage,sendWhatsAppAuthCode} from '../src/whatsapp-cloud.js';

test('Meta AUTHENTICATION template uses one code in body and copy-code URL button',async()=>{
 let captured=null;
 const fetcher=async(_url,options)=>{
  captured=JSON.parse(options.body);
  return {ok:true,json:async()=>({messages:[{id:'wamid.mock.otp'}]})};
 };
 const out=await sendWhatsAppAuthCode({
  accessToken:'test-token',phoneNumberId:'1234567890123',graphVersion:'v23.0',
  to:'3001234567',code:'01234567',fetcher
 });
 assert.equal(out.messageId,'wamid.mock.otp');
 assert.equal(captured.to,'573001234567');
 assert.equal(captured.template.name,'barbernow_codigo_acceso');
 assert.equal(captured.template.language.code,'es');
 assert.deepEqual(captured.template.components.map(x=>x.type),['body','button']);
 assert.equal(captured.template.components[0].parameters[0].text,'01234567');
 assert.equal(captured.template.components[1].parameters[0].text,'01234567');
 assert.equal(captured.template.components[1].sub_type,'url');
 assert.throws(()=>createWhatsAppAuthMessage({to:'30012345670',code:'01234567'}));
 assert.throws(()=>createWhatsAppAuthMessage({to:'3001234567',code:'abcd'}));
});

function setup(){
 const rows=new Map(),limits=new Map(),sent=[];
 const userId=randomUUID();
 const db={
  async query(sql,args=[]){
   if(sql.startsWith('UPDATE auth.whatsapp_challenges SET consumed_at')&&sql.includes('WHERE user_id=')){
    for(const r of rows.values())if(r.user_id===args[0]&&r.purpose===args[1])r.consumed_at=new Date();
    return {rowCount:0,rows:[]};
   }
   if(sql.startsWith('INSERT INTO auth.whatsapp_challenges')){
    rows.set(args[0],{id:args[0],user_id:args[1],phone_e164:args[2],purpose:args[3],
      otp_digest:args[4],attempts:0,expires_at:new Date(Date.now()+300000),consumed_at:null});
    return {rowCount:1,rows:[]};
   }
   if(sql.includes('SET provider_message_id='))return {rowCount:1,rows:[]};
   if(sql.includes('SET consumed_at=now() WHERE id=')){rows.get(args[0]).consumed_at=new Date();return {rowCount:1,rows:[]};}
   if(sql.startsWith('SELECT id,user_id,phone_e164,otp_digest,attempts,expires_at')){
    const r=rows.get(args[0]);
    return {rowCount:r&&r.purpose===args[1]?1:0,rows:r?[r]:[]};
   }
   if(sql.includes('attempts=attempts+1')){rows.get(args[0]).attempts++;return {rowCount:1,rows:[]};}
   if(sql.includes('UPDATE auth.users SET phone_e164='))return {rowCount:1,rows:[]};
   if(sql.startsWith('INSERT INTO auth.action_tokens'))return {rowCount:1,rows:[]};
   throw new Error('Unexpected SQL '+sql.slice(0,80));
  },
  transaction:async fn=>fn(db)
 };
 const redis={eval:async(_lua,_num,key,_ttl)=>{
  const n=(limits.get(key)||0)+1;limits.set(key,n);return n;
 }};
 const otp=createLocalWhatsAppOtp({db,redis,secret:randomBytes(32).toString('base64'),
   send:async({to,code})=>{sent.push({to,code});return {messageId:'wamid.example'};}
 });
 return {db,otp,rows,sent,userId};
}
test('8-digit OTP expires after five minutes, hashes never store raw code and is one-use',async()=>{
 const x=setup();
 const r=await x.otp.start({userId:x.userId,phone:'3001234567',purpose:'signup',ip:'127.0.0.1'});
 assert.equal(r.expiresInSeconds,300);
 assert.match(x.sent[0].code,/^\d{8}$/);
 assert.equal(x.sent[0].to,'+573001234567');
 assert.equal(x.rows.get(r.challengeId).otp_digest.includes(Buffer.from(x.sent[0].code)),false);
 await assert.rejects(x.otp.verify({challengeId:r.challengeId,code:'99999999',purpose:'signup'}),e=>e.statusCode===401);
 assert.equal(x.rows.get(r.challengeId).attempts,1);
 const good=await x.otp.verify({challengeId:r.challengeId,code:x.sent[0].code,purpose:'signup'});
 assert.equal(good.userId,x.userId);
 await assert.rejects(x.otp.verify({challengeId:r.challengeId,code:x.sent[0].code,purpose:'signup'}),e=>e.statusCode===401);
});
test('WhatsApp link OTP is bound to the authenticated account and recovery issues a restricted reset token',async()=>{
 const x=setup();
 const r=await x.otp.start({userId:x.userId,phone:'3001234567',purpose:'link',ip:'127.0.0.1'});
 await assert.rejects(x.otp.verify({challengeId:r.challengeId,code:x.sent[0].code,purpose:'link',
   expectedUserId:randomUUID()}),e=>e.statusCode===401);
 const linked=await x.otp.verify({challengeId:r.challengeId,code:x.sent[0].code,purpose:'link',
   expectedUserId:x.userId});
 assert.equal(linked.userId,x.userId);
 const q=await x.otp.start({userId:x.userId,phone:'3001234567',purpose:'recovery',ip:'127.0.0.1'});
 const rec=await x.otp.verify({challengeId:q.challengeId,code:x.sent[1].code,purpose:'recovery'});
 assert.equal(rec.purpose,'recovery');
 assert.match(rec.recoveryToken,/^[A-Za-z0-9_-]{43}$/);
 assert.equal(rec.userId,undefined);
});
test('WhatsApp OTP send is rate-limited and fails closed when Meta rejects',async()=>{
 const x=setup();
 for(let i=0;i<4;i++)await x.otp.start({userId:x.userId,phone:'3001234567',purpose:'signup',ip:'127.0.0.1'});
 await assert.rejects(x.otp.start({userId:x.userId,phone:'3001234567',purpose:'signup',ip:'127.0.0.1'}),e=>e.statusCode===429);
 const y=setup();
 const failing=createLocalWhatsAppOtp({db:y.db,redis:{eval:async()=>1},secret:randomBytes(32).toString('base64'),
   send:async()=>{throw Error('Sensitive Meta failure must not leak');}
 });
 await assert.rejects(failing.start({userId:y.userId,phone:'3001234567',purpose:'signup'}),e=>
  e.statusCode===503&&!e.message.includes('Sensitive'));
});

[executed on device: vmi3669516 (22a9c8cd-8866-4186-9071-dab9301dff16)]