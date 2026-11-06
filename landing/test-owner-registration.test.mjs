import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerSpace} from './owner-registration.js';
const person={name:'Camila',email:'CAMILA@EXAMPLE.COM',phone:'3001234567',password:'LongPassword2026!'};
const shop={business:'Camila Barber',city:'Bogotá',address:'Calle 1'};
const success={tenantId:'22222222-2222-4222-8222-222222222222',slug:'camila-barber-demo',role:'owner',created:true};
const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
const fakeStorage=()=>{const data=new Map();return {setItem:(key,value)=>data.set(key,value),getItem:key=>data.get(key),entries:()=>[...data.entries()]};};

test('owner registration first requires a WhatsApp OTP and creates no workspace or session yet',async()=>{
 const calls=[],storage=fakeStorage();
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(url.endsWith('/auth/signup'))return response({challengeId:'22222222-2222-4222-8222-222222222222'},201);
  throw Error('Must not create owner before verifying code');
 };
 const result=await createOwnerSpace({person,shop,fetcher,storage});
 assert.equal(result.verificationRequired,true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'/api/v1/auth/signup');
 const data=JSON.parse(calls[0].options.body);
 assert.equal(data.email,'camila@example.com');
 assert.equal(data.data.phone,'3001234567');
 assert.equal(storage.entries().length,0);
});
test('valid WhatsApp OTP verifies account before password login and owner onboarding',async()=>{
 const calls=[],storage=fakeStorage();
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(url.endsWith('/auth/whatsapp/verify'))return response({userId:'33333333-3333-4333-8333-333333333333'});
  if(url.endsWith('/auth/token?grant_type=password'))return response({access_token:'opaque-access',refresh_token:'opaque-refresh',expires_in:3600});
  if(url.endsWith('/owner-onboarding'))return response(success,201);
  throw Error('Unexpected '+url);
 };
 const result=await createOwnerSpace({person,shop,alreadySignedUp:true,challengeId:'22222222-2222-4222-8222-222222222222',
  otpCode:'12345678',fetcher,storage});
 assert.equal(result.role,'owner');
 assert.deepEqual(calls.map(x=>x.url),['/api/v1/auth/whatsapp/verify','/api/v1/auth/token?grant_type=password','/api/v1/owner-onboarding']);
 assert.equal(JSON.parse(calls[0].options.body).purpose,'signup');
 assert.equal(JSON.parse(calls[2].options.body).role,undefined,'Owner role comes from API, not browser');
 assert.equal(calls[2].options.headers.Authorization,'Bearer opaque-access');
 assert.equal(JSON.parse(storage.getItem('barberos_auth_session_v1')).access_token,'opaque-access');
 assert.equal(JSON.stringify(storage.entries()).includes(person.password),false);
});
test('existing verified account logs in without needing a new WhatsApp code',async()=>{
 const calls=[];
 const fetcher=async(url)=>{calls.push(url);
  if(url.endsWith('/auth/token?grant_type=password'))return response({access_token:'opaque',refresh_token:'refresh',expires_in:3600});
  if(url.endsWith('/owner-onboarding'))return response({...success,created:false});
  throw Error('Unexpected '+url);
 };
 const result=await createOwnerSpace({person,shop,existingAccount:true,fetcher,storage:fakeStorage()});
 assert.equal(result.created,false);
 assert.equal(calls.length,2);
});
test('never stores a session or creates workspace if WhatsApp verification fails',async()=>{
 const calls=[],storage=fakeStorage();
 const fetcher=async(url)=>{calls.push(url);
  if(url.endsWith('/auth/whatsapp/verify'))return response({error:'Código inválido'},401);
  if(url.includes('grant_type=password'))return response({error:'Not confirmed'},401);
  throw Error('Unexpected '+url);
 };
 await assert.rejects(createOwnerSpace({person,shop,alreadySignedUp:true,challengeId:success.tenantId,
  otpCode:'00000000',fetcher,storage}),/Código inválido/);
 assert.equal(storage.entries().length,0);
 assert.equal(calls.some(x=>x.endsWith('/owner-onboarding')),false);
});
test('handles idempotent owner onboarding after network interruption',async()=>{
 const storage=fakeStorage(),calls=[];
 const fetcher=async(url)=>{calls.push(url);
  if(url.endsWith('/auth/token?grant_type=password'))return response({access_token:'opaque',refresh_token:'refresh',expires_in:3600});
  if(url.endsWith('/owner-onboarding'))throw Error('Socket closed');
  if(url.endsWith('/tenants'))return response([{id:success.tenantId,slug:success.slug,role:'owner'}]);
  throw Error('Unexpected '+url);
 };
 const result=await createOwnerSpace({person,shop,existingAccount:true,fetcher,storage});
 assert.equal(result.created,false);
 assert.equal(calls.filter(u=>u.endsWith('/owner-onboarding')).length,1);
});
test('never treats barber membership as successful owner onboarding',async()=>{
 const storage=fakeStorage();
 const fetcher=async(url)=>{
  if(url.endsWith('/auth/token?grant_type=password'))return response({access_token:'opaque',refresh_token:'refresh',expires_in:3600});
  if(url.endsWith('/owner-onboarding'))return response({error:'No autorizado'},403);
  if(url.endsWith('/tenants'))return response([{id:success.tenantId,slug:success.slug,role:'barber'}]);
  throw Error('Unexpected '+url);
 };
 await assert.rejects(createOwnerSpace({person,shop,existingAccount:true,fetcher,storage}),/No autorizado/);
 assert.equal(storage.entries().length,0);
});

[executed on device: vmi3669516 (22a9c8cd-8866-4186-9071-dab9301dff16)]