import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createRecoveryPhoneVerification} from '../src/recovery-phone-verification.js';

const targetId='11111111-1111-4111-8111-111111111111';
const adminId='22222222-2222-4222-8222-222222222222';
const otherId='33333333-3333-4333-8333-333333333333';
const phone='3001234567';
const users=[
 {id:targetId,email:'target@example.invalid',user_metadata:{phone},app_metadata:{}},
 {id:otherId,email:'other@example.invalid',user_metadata:{phone},app_metadata:{}},
 {id:'44444444-4444-4444-8444-444444444444',email:'deleted@example.invalid',user_metadata:{phone},
  app_metadata:{barbernow_deleted_at:'2026-10-10T00:00:00Z'}}
];
function fixture({failSend=false}={}){
 const challenges=new Map(),claims=new Map(),sent=[],redisCounts=new Map();
 const db={
  transaction:async fn=>fn(db),
  async query(sql,args=[]){
   if(sql.includes('FROM public.barbernow_verified_auth_phones WHERE user_id=$1 OR phone_e164=$2')){
    const entries=[...claims].filter(([userId,p])=>userId===args[0]||p===args[1])
     .map(([user_id,phone_e164])=>({user_id,phone_e164}));
    return {rowCount:entries.length,rows:entries};
   }
   if(sql.includes('FROM public.barbernow_verified_auth_phones WHERE phone_e164=$1')){
    const entries=[...claims].filter(([,p])=>p===args[0]).map(([user_id])=>({user_id}));
    return {rowCount:entries.length,rows:entries};
   }
   if(sql.includes('UPDATE public.barbernow_phone_verification SET consumed_at=now() WHERE user_id=$1')){
    for(const row of challenges.values())if(row.user_id===args[0])row.consumed_at=new Date();
    return {rowCount:0,rows:[]};
   }
   if(sql.includes('INSERT INTO public.barbernow_phone_verification(')){
    challenges.set(args[0],{id:args[0],user_id:args[1],phone_e164:args[2],code_digest:args[3],
      attempts:0,expires_at:new Date(Date.now()+300000),consumed_at:null});
    return {rowCount:1,rows:[]};
   }
   if(sql.includes('SET provider_message_id='))return {rowCount:1,rows:[]};
   if(sql.includes('FROM public.barbernow_phone_verification WHERE id=$1 FOR UPDATE')){
    const row=challenges.get(args[0]);return {rowCount:row?1:0,rows:row?[row]:[]};
   }
   if(sql.includes('SET attempts=attempts+1')){
    challenges.get(args[0]).attempts++;return {rowCount:1,rows:[]};
   }
   if(sql.includes('INSERT INTO public.barbernow_verified_auth_phones(')){
    for(const [u,p] of claims){
     if(p===args[1]&&u!==args[0])throw Object.assign(new Error('Phone conflict'),{code:'23505'});
    }
    claims.set(args[0],args[1]);return {rowCount:1,rows:[]};
   }
   if(sql.includes('UPDATE public.barbernow_phone_verification SET consumed_at=now() WHERE id=$1')){
    challenges.get(args[0]).consumed_at=new Date();return {rowCount:1,rows:[]};
   }
   throw Error('Unexpected SQL '+sql.slice(0,90));
  }
 };
 const provider={auth:{admin:{
  getUserById:async id=>({data:{user:users.find(x=>x.id===id)||null},error:null}),
  listUsers:async()=>({data:{users},error:null})
 }}};
 const redis={eval:async(_lua,_n,key)=>{
  const next=(redisCounts.get(key)||0)+1;redisCounts.set(key,next);return next;
 }};
 const service=createRecoveryPhoneVerification({
  recoveryDb:db,redis,secret:randomBytes(32).toString('base64'),identityProvider:provider,
  sendCode:async({phone,code})=>{
   if(failSend)throw Error('Meta rejected verification');
   sent.push({phone,code});return 'wamid.synthetic';
  }
 });
 return {service,challenges,claims,sent,redisCounts};
}

test('admin can prove one account controls a shared WhatsApp without leaking raw code to PostgreSQL',async()=>{
 const x=fixture();
 const original=await x.service.status({userId:targetId});
 assert.equal(original.sharedWithOthers,1,'Archived test user does not count');
 assert.equal(original.phoneVerified,false);
 assert.equal(original.recoveryEligible,false);
 const challenge=await x.service.start({userId:targetId,adminId,ip:'localhost'});
 assert.match(challenge.challengeId,/^[0-9a-f-]{36}$/);
 assert.equal(x.sent[0].phone,'+573001234567');
 assert.match(x.sent[0].code,/^[0-9]{8}$/);
 assert.equal(x.challenges.get(challenge.challengeId).code_digest.includes(Buffer.from(x.sent[0].code)),false);
 await assert.rejects(x.service.confirm({
  userId:targetId,adminId,ip:'localhost',challengeId:challenge.challengeId,code:'00000000'
 }),e=>e.statusCode===401);
 const done=await x.service.confirm({
  userId:targetId,adminId,ip:'localhost',challengeId:challenge.challengeId,code:x.sent[0].code
 });
 assert.deepEqual(done,{ok:true,phoneVerified:true});
 assert.equal(x.claims.get(targetId),'+573001234567');
 const updated=await x.service.status({userId:targetId});
 assert.equal(updated.phoneVerified,true);
 assert.equal(updated.recoveryEligible,true);
 await assert.rejects(x.service.confirm({
  userId:targetId,adminId,ip:'localhost',challengeId:challenge.challengeId,code:x.sent[0].code
 }),e=>e.statusCode===401);
 await assert.rejects(x.service.start({userId:otherId,adminId,ip:'localhost'}),e=>e.statusCode===409);
});
test('Meta rejection invalidates the verification challenge without falsely marking it verified',async()=>{
 const x=fixture({failSend:true});
 await assert.rejects(x.service.start({userId:targetId,adminId,ip:'localhost'}),e=>e.statusCode===503);
 const recorded=[...x.challenges.values()];
 assert.equal(recorded.length,1);
 assert.ok(recorded[0].consumed_at);
 assert.equal(x.claims.size,0);
});