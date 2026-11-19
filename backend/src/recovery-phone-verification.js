import {randomInt,randomUUID,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {normalizeBookingPhone} from './whatsapp-cloud.js';
import {failure} from './security.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE=/^\+573[0-9]{9}$/;
const CODE=/^[0-9]{8}$/;
const verifiedPhone=value=>{
 try{const result=normalizeBookingPhone(value);return PHONE.test(result)?result:null;}
 catch{return null;}
};
const archived=user=>Boolean(user?.app_metadata?.barbernow_deleted_at);
const stillActive=user=>!archived(user)&&!(user?.banned_until&&new Date(user.banned_until).getTime()>Date.now());

export function createRecoveryPhoneVerification({recoveryDb,redis,secret,identityProvider,sendCode,clock=()=>new Date()}){
 if(!recoveryDb||!redis||!identityProvider||!sendCode)throw Error('Phone verification dependencies are required');
 const pepper=Buffer.from(secret||'','base64');
 if(pepper.length<32)throw Error('Phone verification requires 32 bytes of random secret');
 const digest=(id,code)=>createHmac('sha256',pepper).update('phone-verify:'+id+':'+code).digest();
 async function rate(key,max,seconds){
  const hash=createHash('sha256').update(key).digest('hex');
  const redisKey='barbernow:auth:phone-verification:'+hash;
  let total;
  try{
   total=Number(await redis.eval(
    "local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]);end;return n",
    1,redisKey,seconds));
  }catch{failure(503,'Servicio de seguridad temporalmente no disponible');}
  if(total>max)failure(429,'Demasiados intentos. Intenta más tarde.');
 }
 async function identity(userId){
  if(!UUID.test(String(userId)))failure(400,'Usuario inválido');
  const {data,error}=await identityProvider.auth.admin.getUserById(userId);
  if(error||!data?.user||!stillActive(data.user))failure(404,'Cuenta no disponible');
  return data.user;
 }
 async function countShares(phone){
  const all=[];
  for(let page=1;page<=10;page++){
   const {data,error}=await identityProvider.auth.admin.listUsers({page,perPage:200});
   if(error)failure(503,'No se pudo comprobar el directorio');
   const users=data?.users||[];
   all.push(...users);
   if(users.length<200)break;
  }
  return all.filter(u=>stillActive(u)&&verifiedPhone(u.phone||u.user_metadata?.phone)===phone).length;
 }
 async function status({userId}){
  const user=await identity(userId);
  const phone=verifiedPhone(user.phone||user.user_metadata?.phone);
  if(!phone)return {phoneValid:false,phoneVerified:false,sharedWithOthers:0,recoveryEligible:false};
  const owners=await recoveryDb.query('SELECT user_id,phone_e164 FROM public.barbernow_verified_auth_phones WHERE user_id=$1 OR phone_e164=$2',[userId,phone]);
  const own=owners.rows.find(x=>x.user_id===userId);
  const claim=own?.phone_e164===phone;
  const another=owners.rows.some(x=>x.user_id!==userId&&x.phone_e164===phone);
  const stale=Boolean(own&&!claim);
  const shared=Math.max(0,(await countShares(phone))-1);
  return {phoneValid:true,phoneVerified:Boolean(claim),sharedWithOthers:shared,
    recoveryEligible:!stale&&!another&&(Boolean(claim)||shared===0)};
 }
 async function start({userId,adminId,ip}){
  const user=await identity(userId);
  if(!UUID.test(String(adminId)))failure(403,'Administrador inválido');
  const phone=verifiedPhone(user.phone||user.user_metadata?.phone);
  if(!phone)failure(409,'La cuenta no tiene un celular colombiano válido registrado');
  const existing=await recoveryDb.query('SELECT user_id FROM public.barbernow_verified_auth_phones WHERE phone_e164=$1',[phone]);
  if(existing.rows.some(x=>x.user_id!==userId))failure(409,'Ese celular ya está verificado para otra cuenta.');
  await rate('admin:'+adminId,12,3600);
  await rate('phone:'+phone,3,3600);
  await rate('account:'+userId,3,3600);
  await rate('ip:'+ip,20,3600);
  const id=randomUUID(),code=String(randomInt(10000000,100000000));
  await recoveryDb.query('UPDATE public.barbernow_phone_verification SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL',[userId]);
  await recoveryDb.query("INSERT INTO public.barbernow_phone_verification(id,user_id,phone_e164,code_digest,expires_at) VALUES($1,$2,$3,$4,now()+interval '5 minutes')",
   [id,userId,phone,digest(id,code)]);
  try{
   const messageId=await sendCode({phone,code});
   await recoveryDb.query('UPDATE public.barbernow_phone_verification SET provider_message_id=$2 WHERE id=$1',[id,messageId]);
  }catch{
   await recoveryDb.query('UPDATE public.barbernow_phone_verification SET consumed_at=now() WHERE id=$1',[id]);
   failure(503,'Meta no pudo aceptar el código de verificación. Revisa el estado de WhatsApp e inténtalo después.');
  }
  return {challengeId:id,expiresInSeconds:300,message:'Se solicitó el código al WhatsApp registrado.'};
 }
 async function confirm({userId,adminId,challengeId,code,ip}){
  if(!UUID.test(String(userId))||!UUID.test(String(adminId))||!UUID.test(String(challengeId))||
     !CODE.test(String(code||'')))failure(400,'Código inválido');
  const user=await identity(userId);
  const phone=verifiedPhone(user.phone||user.user_metadata?.phone);
  if(!phone)failure(409,'El celular registrado ya no es válido');
  await rate('verify:'+ip,30,3600);
  const result=await recoveryDb.transaction(async tx=>{
   const q=await tx.query("SELECT user_id,phone_e164,code_digest,attempts,expires_at,consumed_at FROM public.barbernow_phone_verification WHERE id=$1 FOR UPDATE",[challengeId]);
   const r=q.rows[0];
   if(!r||r.user_id!==userId||r.phone_e164!==phone||r.consumed_at||r.attempts>=5||
      new Date(r.expires_at)<=clock())return false;
   const expected=digest(challengeId,code),actual=r.code_digest;
   if(!Buffer.isBuffer(actual)||expected.length!==actual.length||!timingSafeEqual(expected,actual)){
    await tx.query('UPDATE public.barbernow_phone_verification SET attempts=attempts+1 WHERE id=$1',[challengeId]);
    return false;
   }
   try{
    await tx.query("INSERT INTO public.barbernow_verified_auth_phones(user_id,phone_e164,verified_at,verified_by) VALUES($1,$2,now(),$3) ON CONFLICT (user_id) DO UPDATE SET phone_e164=EXCLUDED.phone_e164,verified_at=EXCLUDED.verified_at,verified_by=EXCLUDED.verified_by",
       [userId,phone,adminId]);
   }catch(e){
    if(e.code==='23505')failure(409,'El celular ya está verificado para otra cuenta.');
    throw e;
   }
   await tx.query('UPDATE public.barbernow_phone_verification SET consumed_at=now() WHERE id=$1',[challengeId]);
   return true;
  });
  if(!result)failure(401,'Código incorrecto, vencido o ya utilizado');
  return {ok:true,phoneVerified:true};
 }
 return {status,start,confirm};
}