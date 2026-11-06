import {randomInt,randomUUID,randomBytes,createHmac,createHash,timingSafeEqual} from 'node:crypto';
import {normalizeBookingPhone} from './whatsapp-cloud.js';

const fail=(statusCode,message)=>Object.assign(new Error(message),{statusCode});
const hashKey=value=>createHash('sha256').update(value).digest('hex');
const resetToken=()=>randomBytes(32).toString('base64url');
const codeMatcher=/^[0-9]{8}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Own time-limited, one-use WhatsApp OTP; the DB never stores plaintext codes. */
export function createLocalWhatsAppOtp({db,redis,secret,send}){
 if(!db||!redis||typeof send!=='function')throw Error('WhatsApp OTP requires database, Redis and Meta sender');
 const pepper=Buffer.from(String(secret||''),'base64');
 if(pepper.length<32)throw Error('AUTH_OTP_SECRET must contain >=32 random bytes in base64');
 const digest=(challenge,code)=>createHmac('sha256',pepper).update(challenge+':'+code).digest();
 async function limits({userId,phone,ip}){
  const groups=[
   ['user',userId,4,3600],
   ['phone',phone,4,3600],
   ['ip',ip,16,3600],
  ];
  for(const [type,value,max,ttl] of groups){
   const key='barbernow:otp:'+type+':'+hashKey(String(value||''));
   const count=Number(await redis.eval(
    "local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]);end;return n",
    1,key,ttl));
   if(count>max)throw fail(429,'Límite de códigos alcanzado. Intenta más tarde');
  }
 }
 async function start({userId,phone,purpose,ip='unknown'}){
  if(!uuid.test(String(userId))||!['signup','recovery','link'].includes(purpose))
   throw fail(400,'Solicitud de código inválida');
  let recipient;
  try{recipient=normalizeBookingPhone(phone);}
  catch{throw fail(400,'El celular colombiano debe tener 10 dígitos y empezar por 3');}
  if(!/^\+573[0-9]{9}$/.test(recipient))throw fail(400,'Solo celulares colombianos válidos');
  await limits({userId,phone:recipient,ip});
  const id=randomUUID();
  const code=String(randomInt(0,100000000)).padStart(8,'0');
  await db.query("UPDATE auth.whatsapp_challenges SET consumed_at=now() WHERE user_id=$1 AND purpose=$2 AND consumed_at IS NULL",
   [userId,purpose]);
  await db.query("INSERT INTO auth.whatsapp_challenges(id,user_id,phone_e164,purpose,otp_digest,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '5 minutes')",
   [id,userId,recipient,purpose,digest(id,code)]);
  try{
   const result=await send({to:recipient,code});
   await db.query('UPDATE auth.whatsapp_challenges SET provider_message_id=$2 WHERE id=$1',[id,result.messageId]);
  }catch{
   await db.query('UPDATE auth.whatsapp_challenges SET consumed_at=now() WHERE id=$1',[id]);
   throw fail(503,'WhatsApp no pudo aceptar el código. Intenta de nuevo más tarde');
  }
  return {challengeId:id,expiresInSeconds:300,channel:'whatsapp'};
 }
 async function verify({challengeId,code,purpose,expectedUserId=null,setupPasswordHash=null}){
  if(!uuid.test(String(challengeId))||!codeMatcher.test(String(code||''))||
     !['signup','recovery','link'].includes(purpose))
    throw fail(400,'Código de verificación inválido');
  const outcome=await db.transaction(async tx=>{
   const rows=await tx.query("SELECT id,user_id,phone_e164,otp_digest,attempts,expires_at,consumed_at FROM auth.whatsapp_challenges WHERE id=$1 AND purpose=$2 FOR UPDATE",
    [challengeId,purpose]);
   const row=rows.rows[0];
   if(!row||(expectedUserId&&row.user_id!==expectedUserId)||row.consumed_at||new Date(row.expires_at)<=new Date()||row.attempts>=5)
    return {invalid:true};
   const expected=Buffer.isBuffer(row.otp_digest)?row.otp_digest:Buffer.from(row.otp_digest);
   const actual=digest(challengeId,String(code));
   if(expected.length!==actual.length||!timingSafeEqual(expected,actual)){
    await tx.query('UPDATE auth.whatsapp_challenges SET attempts=attempts+1 WHERE id=$1',[challengeId]);
    return {invalid:true};
   }
   if(setupPasswordHash!==null){
    if(purpose!=='signup'||typeof setupPasswordHash!=='string'||!/^\$2[aby]\$/.test(setupPasswordHash))
      throw fail(400,'El código no corresponde a una invitación');
    const updated=await tx.query('UPDATE auth.users SET encrypted_password=$2,updated_at=now() WHERE id=$1 AND encrypted_password IS NULL RETURNING id',
      [row.user_id,setupPasswordHash]);
    if(!updated.rowCount)throw fail(409,'La contraseña de esta cuenta ya está configurada');
   }
   await tx.query('UPDATE auth.whatsapp_challenges SET consumed_at=now() WHERE id=$1',[challengeId]);
   if(purpose==='signup'||purpose==='link'){
    // Only a verified OTP may bind the phone to an account.
    await tx.query("UPDATE auth.users SET phone_e164=$2,phone_verified_at=now(),email_confirmed_at=COALESCE(email_confirmed_at,now()),updated_at=now() WHERE id=$1",
      [row.user_id,row.phone_e164]);
    return {userId:row.user_id,purpose};
   }
   // Recovery grants a restricted *reset token*, never full account access.
   const key=resetToken();
   await tx.query("INSERT INTO auth.action_tokens(user_id,token_hash,purpose,expires_at) VALUES($1,$2,'recover_password',now()+interval '5 minutes')",
     [row.user_id,createHash('sha256').update(key).digest()]);
   return {purpose,recoveryToken:key};
  });
  if(outcome.invalid)throw fail(401,'Código incorrecto, vencido o ya utilizado');
  return outcome;
 }
 return {start,verify};
}