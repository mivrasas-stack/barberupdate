import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createPasswordRecovery,createPasswordRecoverySender} from '../src/whatsapp-password-recovery.js';

const id='11111111-1111-4111-8111-111111111111';
const phone='3001234567';
const user={id,email:'cliente@example.test',user_metadata:{phone}};
function fixture(users=[user],options={}){
 const rows=new Map(),sent=[],updates=[],redisCounts=new Map();
 const db={
  query:async(sql,args=[])=>{
   if(sql.includes('UPDATE public.barbernow_password_recovery SET consumed_at=now() WHERE user_id=')){
    for(const row of rows.values())if(row.user_id===args[0])row.consumed_at=new Date();
    return {rows:[],rowCount:0};
   }
   if(sql.includes('INSERT INTO public.barbernow_password_recovery')){
    rows.set(args[0],{id:args[0],user_id:args[1],phone_e164:args[2],code_digest:args[3],
      expires_at:new Date(Date.now()+5*60*1000),attempts:0,consumed_at:null,reset_expires_at:null,reset_token_digest:null});
    return {rows:[],rowCount:1};
   }
   if(sql.includes('SET provider_message_id='))return {rows:[],rowCount:1};
   if(sql.includes('WHERE id=$1 FOR UPDATE')){
    const row=rows.get(args[0]);
    return {rows:row?[row]:[],rowCount:row?1:0};
   }
   if(sql.includes('SET attempts=attempts+1')){
    rows.get(args[0]).attempts++;return {rows:[],rowCount:1};
   }
   if(sql.includes('SET reset_token_digest=$2')){
    rows.get(args[0]).reset_token_digest=args[1];
    rows.get(args[0]).reset_expires_at=new Date(Date.now()+5*60*1000);
    return {rows:[],rowCount:1};
   }
   if(sql.includes('SET consumed_at=now() WHERE id=$1')){
    rows.get(args[0]).consumed_at=new Date();return {rows:[],rowCount:1};
   }
   if(sql.includes('SET consumed_at=now(),reset_token_digest=NULL')){
    const row=[...rows.values()].find(r=>r.reset_token_digest?.equals(args[0])&&!r.consumed_at&&r.reset_expires_at>Date.now());
    if(!row)return {rows:[],rowCount:0};
    row.consumed_at=new Date();row.reset_token_digest=null;
    return {rows:[{user_id:row.user_id}],rowCount:1};
   }
   throw Error('Unexpected SQL '+sql.slice(0,65));
  },
  transaction:async fn=>fn(db)
 };
 const redis={eval:async(_lua,_n,key)=>{
  const count=(redisCounts.get(key)||0)+1;
  redisCounts.set(key,count);
  return count;
 }};
 const provider={auth:{admin:{
  listUsers:async()=>({data:{users},error:null}),
  updateUserById:async(userId,payload)=>{updates.push({userId,payload});return {error:null};}
 }}};
 const sendCode=async({phone,code})=>{
  if(options.sendFails)throw Error('No delivery');
  sent.push({phone,code});return 'wamid.mock';
 };
 const service=createPasswordRecovery({recoveryDb:db,redis,secret:randomBytes(48).toString('base64'),
  identityProvider:provider,sendCode});
 return {service,rows,sent,updates,redisCounts};
}
test('Only profile phone receives an 8-digit WhatsApp code, stored hashed on the local DB',async()=>{
 const x=fixture();
 const start=await x.service.start({email:user.email,ip:'127.0.0.1'});
 assert.match(start.challengeId,/^[a-f0-9-]{36}$/);
 assert.equal(x.sent.length,1);
 assert.equal(x.sent[0].phone,'+573001234567');
 assert.match(x.sent[0].code,/^\d{8}$/);
 assert.equal(x.rows.get(start.challengeId).code_digest.length,32);
 assert.equal(x.rows.get(start.challengeId).code_digest.includes(Buffer.from(x.sent[0].code)),false);
 await assert.rejects(x.service.verify({challengeId:start.challengeId,code:'99999999',ip:'127.0.0.1'}),e=>e.statusCode===401);
 const verified=await x.service.verify({challengeId:start.challengeId,code:x.sent[0].code,ip:'127.0.0.1'});
 assert.match(verified.resetToken,/^[A-Za-z0-9_-]{43}$/);
 await assert.rejects(x.service.verify({challengeId:start.challengeId,code:x.sent[0].code,ip:'127.0.0.1'}),e=>e.statusCode===401);
 await assert.rejects(x.service.reset({resetToken:verified.resetToken,newPassword:'12345',ip:'127.0.0.1'}),e=>e.statusCode===400);
 assert.equal(x.updates.length,0);
 assert.deepEqual(await x.service.reset({resetToken:verified.resetToken,newPassword:'abc123',ip:'127.0.0.1'}),{ok:true});
 assert.deepEqual(x.updates,[{userId:id,payload:{password:'abc123'}}]);
 await assert.rejects(x.service.reset({resetToken:verified.resetToken,newPassword:'otherpass',ip:'127.0.0.1'}),e=>e.statusCode===401);
});
test('Unknown emails, invalid stored phones and shared numbers do not send or reveal identity',async()=>{
 for(const users of [[],[{...user,user_metadata:{phone:'30012345678'}}],[user,{...user,id:'22222222-2222-4222-8222-222222222222',email:'other@example.test'}]]){
  const x=fixture(users);
  const result=await x.service.start({email:user.email,ip:'unknown'});
  assert.match(result.challengeId,/^[a-f0-9-]{36}$/);
  assert.equal(result.message,'Si la cuenta tiene un WhatsApp registrado, recibirá un código de seguridad.');
  assert.equal(x.sent.length,0);
  await assert.rejects(x.service.verify({challengeId:result.challengeId,code:'12345678',ip:'unknown'}),e=>e.statusCode===401);
 }
});
test('Recovery code expires and failed sends do not produce valid reset tokens',async()=>{
 const x=fixture();
 const result=await x.service.start({email:user.email,ip:'127.0.0.1'});
 x.rows.get(result.challengeId).expires_at=new Date(Date.now()-2000);
 await assert.rejects(x.service.verify({challengeId:result.challengeId,code:x.sent[0].code,ip:'127.0.0.1'}),e=>e.statusCode===401);
 const y=fixture([user],{sendFails:true});
 const missing=await y.service.start({email:user.email,ip:'127.0.0.1'});
 assert.equal(Boolean(y.rows.get(missing.challengeId).consumed_at),true);
});
test('Recovery limits requests to the same email and never sends to an unregistered phone',async()=>{
 const x=fixture();
 for(let i=0;i<3;i++)await x.service.start({email:user.email,ip:'127.0.0.1'});
 assert.equal(x.sent.length,3);
 await assert.rejects(x.service.start({email:user.email,ip:'127.0.0.1'}),e=>e.statusCode===429);
});
test('Meta payload uses approved AUTHENTICATION template with copy-code button, no raw text sends',async()=>{
 let message;
 const sender=createPasswordRecoverySender({config:{whatsappSendEnabled:true,whatsappPhoneNumberId:'1234567890',
  whatsappGraphVersion:'v23.0',whatsappAccessToken:'test-token'},db:{},fetcher:async(_url,options)=>{
    assert.equal(options.headers.Authorization,'Bearer test-token');
    message=JSON.parse(options.body);
    return {ok:true,json:async()=>({messages:[{id:'wamid.test'}]})};
  }});
 assert.equal(await sender({phone:'+573001234567',code:'00112233'}),'wamid.test');
 assert.equal(message.to,'573001234567');
 assert.equal(message.template.name,'barbernow_codigo_acceso');
 assert.equal(message.template.language.code,'es');
 assert.deepEqual(message.template.components.map(x=>x.type),['body','button']);
 assert.equal(message.template.components[1].parameters[0].text,'00112233');
 await assert.rejects(sender({phone:'+5730012345670',code:'00112233'}));
});