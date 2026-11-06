import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {createLocalAuth} from '../src/local-auth.js';

function fixture(user){
 const sessions=[],events=[],counters=new Map();
 const redis={
  incr:async key=>{const v=(counters.get(key)||0)+1;counters.set(key,v);return v},
  expire:async()=>true,del:async key=>counters.delete(key)
 };
 const db={
  async query(sql,args=[]){
   if(sql.includes('FROM auth.users WHERE lower(email)')){
    const found=user.email===args[0]?[user]:[];
    return {rowCount:found.length,rows:found};
   }
   if(sql.includes('INSERT INTO auth.sessions')){
    sessions.push({user_id:args[0],access:args[1],refresh:args[2],active:true});
    return {rowCount:1,rows:[]};
   }
   if(sql.includes('SET last_sign_in_at='))return {rowCount:1,rows:[]};
   if(sql.includes('FROM auth.sessions s')&&sql.includes('access_token_hash=')){
    const found=sessions.find(s=>s.active&&s.access.equals(args[0]));
    return {rowCount:found?1:0,rows:found?[user]:[]};
   }
   if(sql.includes('FROM auth.sessions s')&&sql.includes('refresh_token_hash=')){
    const found=sessions.find(s=>s.active&&s.refresh.equals(args[0]));
    return {rowCount:found?1:0,rows:found?[{...user,session_id:found.session_id||'11111111-1111-4111-8111-111111111111'}]:[]};
   }
   if(sql.includes('UPDATE auth.sessions SET access_token_hash=')){
    const found=sessions.find(s=>s.active);
    found.access=args[1];found.refresh=args[2];
    return {rowCount:1,rows:[]};
   }
   if(sql.includes('UPDATE auth.sessions SET revoked_at=')){
    sessions.forEach(s=>{if(s.access.equals(args[0]))s.active=false});
    return {rowCount:1,rows:[]};
   }
   if(sql.includes('UPDATE auth.users SET encrypted_password=')){
    user.encrypted_password=args[1];return {rowCount:1,rows:[user]};
   }
   if(sql.includes('UPDATE auth.sessions SET revoked_at=now() WHERE user_id=')){
    sessions.forEach(s=>s.active=false);return {rowCount:1,rows:[]};
   }
   if(sql.includes('DELETE FROM auth.sessions'))return {rowCount:0,rows:[]};
   throw Error('Unexpected SQL in auth fixture');
  },
  transaction:async fn=>fn(db)
 };
 return {db,redis,sessions,events};
}
test('self-hosted auth logs in a bcrypt $2a$ account with the original password',async()=>{
 const old=await bcrypt.hash('ExampleOldPassword123!',12);
 const user={id:randomUUID(),email:'example@test.invalid',encrypted_password:old,
  email_confirmed_at:new Date(),raw_user_meta_data:{full_name:'Legacy Client'},raw_app_meta_data:{},created_at:new Date()};
 const x=fixture(user);
 const auth=createLocalAuth({db:x.db,redis:x.redis,mailer:null,publicOrigin:'https://example.invalid'});
 await assert.rejects(auth.login(user.email,'IncorrectPass123!','127.0.0.1'),e=>e.statusCode===401);
 const issued=await auth.login(user.email,'ExampleOldPassword123!','127.0.0.1');
 assert.equal(issued.user.id,user.id);
 assert.equal(issued.user.user_metadata.full_name,'Legacy Client');
 assert.equal((await auth.authenticate(issued.access_token)).id,user.id);
 const rotated=await auth.refresh(issued.refresh_token);
 assert.notEqual(rotated.access_token,issued.access_token);
 await assert.rejects(auth.authenticate(issued.access_token),e=>e.statusCode===401);
 await assert.rejects(auth.refresh(issued.refresh_token),e=>e.statusCode===401);
 await auth.logout(rotated.access_token);
 await assert.rejects(auth.authenticate(rotated.access_token),e=>e.statusCode===401);
});
test('self-hosted authentication fails closed without SMTP for signups and recovery',async()=>{
 const user={id:randomUUID(),email:'nobody@test.invalid',encrypted_password:null,
  email_confirmed_at:null,raw_user_meta_data:{},raw_app_meta_data:{},created_at:new Date()};
 const x=fixture(user);
 const auth=createLocalAuth({db:x.db,redis:x.redis,mailer:null,publicOrigin:'https://example.invalid'});
 await assert.rejects(auth.signup('new@test.invalid','ValidNewPass123!'),e=>e.statusCode===503);
 await assert.rejects(auth.recover('nobody@test.invalid'),e=>e.statusCode===503);
 await assert.rejects(auth.authenticate('malformed'),e=>e.statusCode===401);
 await assert.rejects(auth.login(user.email,'ValidNewPass123!','127.0.0.1'),e=>e.statusCode===401);
});

[executed on device: vmi3669516 (22a9c8cd-8866-4186-9071-dab9301dff16)]