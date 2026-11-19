import {randomInt,randomUUID,randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {normalizeBookingPhone} from './whatsapp-cloud.js';
import {resolveWhatsAppIntegration} from './integration-secrets.js';
import {createDb} from './db.js';
import {failure,parseOrThrow} from './security.js';

const EMAIL=z.email().max(254);
const PIN=z.string().regex(/^[0-9]{8}$/);
const ID=z.uuid();
const RESET=z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const PASSWORD=z.string().min(6).max(128);
const PHONE=/^\+573[0-9]{9}$/;
const GENERIC='Si la cuenta tiene un WhatsApp registrado, recibirá un código de seguridad.';
const codeHash=(secret,id,code)=>createHmac('sha256',secret).update(id+':'+code).digest();
const tokenHash=value=>createHash('sha256').update(value).digest();
const safeMobile=value=>{
 try{const phone=normalizeBookingPhone(value);return PHONE.test(phone)?phone:null;}
 catch{return null;}
};
export function createPasswordRecoverySender({config,db,fetcher=fetch}){
 return async({phone,code})=>{
  if(!PHONE.test(phone)||!/^[0-9]{8}$/.test(code))throw Error('Invalid WhatsApp code request');
  const meta=await resolveWhatsAppIntegration(db,config);
  if(!meta.whatsappSendEnabled||!meta.whatsappPhoneNumberId||!meta.whatsappAccessToken)
   throw Error('WhatsApp disabled');
  if(!/^v\d{1,2}\.\d$/.test(meta.whatsappGraphVersion)||!/^\d{5,25}$/.test(meta.whatsappPhoneNumberId))
   throw Error('Invalid Meta Graph configuration');
  const body={
   messaging_product:'whatsapp',recipient_type:'individual',to:phone.slice(1),type:'template',
   template:{name:'barbernow_codigo_acceso',language:{code:'es'},components:[
    {type:'body',parameters:[{type:'text',text:code}]},
    {type:'button',sub_type:'url',index:'0',parameters:[{type:'text',text:code}]}
   ]}
  };
  const res=await fetcher('https://graph.facebook.com/'+meta.whatsappGraphVersion+'/'+meta.whatsappPhoneNumberId+'/messages',{
   method:'POST',headers:{Authorization:'Bearer '+meta.whatsappAccessToken,'content-type':'application/json'},
   body:JSON.stringify(body),signal:AbortSignal.timeout(10000)
  });
  if(!res.ok)throw Error('Meta rejected authentication template');
  const reply=await res.json();
  const messageId=reply?.messages?.[0]?.id;
  if(typeof messageId!=='string'||!messageId.startsWith('wamid.'))throw Error('Meta did not acknowledge the message');
  return messageId;
 };
}
export function createPasswordRecovery({recoveryDb,redis,secret,identityProvider,sendCode,clock=()=>new Date()}){
 if(!recoveryDb||!redis||!identityProvider||!sendCode)throw Error('Recovery dependencies incomplete');
 const pepper=Buffer.from(secret||'','base64');
 if(pepper.length<32)throw Error('RECOVERY_OTP_SECRET must be at least 32 random base64 bytes');
 const digestKey=(type,value)=>'barbernow:recover:'+type+':'+createHash('sha256').update(String(value)).digest('hex');
 async function throttle(type,value,max,seconds){
  const key=digestKey(type,value);
  let number;
  try{
   number=Number(await redis.eval("local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]);end;return n",1,key,seconds));
  }catch{failure(503,'Protección temporalmente no disponible');}
  if(number>max)failure(429,'Demasiadas solicitudes. Intenta más tarde.');
 }
 async function findAccount(email){
  // Legacy accounts are read through the existing server-side identity admin API.
  // Never allow a phone entered by the requester to replace the one on record.
  const all=[];
  for(let page=1;page<=10;page++){
   const {data,error}=await identityProvider.auth.admin.listUsers({page,perPage:200});
   if(error)failure(503,'Directorio de cuentas temporalmente no disponible');
   const users=data?.users||[];
   all.push(...users);
   if(users.length<200)break;
  }
  const account=all.find(u=>String(u.email||'').toLowerCase()===email);
  if(!account)return null;
  const phone=safeMobile(account.phone||account.user_metadata?.phone);
  if(!phone)return null;
  // A shared phone cannot authorize takeover of two separate identities.
  const owners=all.filter(u=>safeMobile(u.phone||u.user_metadata?.phone)===phone);
  if(owners.length!==1)return null;
  return {userId:account.id,phone};
 }
 async function start({email,ip}){
  const address=parseOrThrow(EMAIL,String(email||'').trim().toLowerCase());
  await throttle('ip-start',ip,10,3600);
  await throttle('email-start',address,3,3600);
  const id=randomUUID();
  const publicResult={challengeId:id,expiresInSeconds:300,message:GENERIC};
  const user=await findAccount(address);
  if(!user)return publicResult;
  await throttle('phone-start',user.phone,3,3600);
  const code=String(randomInt(0,100000000)).padStart(8,'0');
  await recoveryDb.query("UPDATE public.barbernow_password_recovery SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL",[user.userId]);
  await recoveryDb.query("INSERT INTO public.barbernow_password_recovery(id,user_id,phone_e164,code_digest,expires_at) VALUES($1,$2,$3,$4,now()+interval '5 minutes')",
   [id,user.userId,user.phone,codeHash(pepper,id,code)]);
  try{
   const messageId=await sendCode({phone:user.phone,code});
   await recoveryDb.query('UPDATE public.barbernow_password_recovery SET provider_message_id=$2 WHERE id=$1',[id,messageId]);
  }catch{
   await recoveryDb.query('UPDATE public.barbernow_password_recovery SET consumed_at=now() WHERE id=$1',[id]);
  }
  return publicResult;
 }
 async function verify({challengeId,code,ip}){
  const id=parseOrThrow(ID,challengeId),pin=parseOrThrow(PIN,code);
  await throttle('ip-verify',ip,30,3600);
  const out=await recoveryDb.transaction(async tx=>{
   const found=await tx.query("SELECT id,user_id,code_digest,attempts,expires_at,consumed_at,reset_expires_at FROM public.barbernow_password_recovery WHERE id=$1 FOR UPDATE",[id]);
   const row=found.rows[0];
   if(!row||row.consumed_at||new Date(row.expires_at)<=clock()||row.attempts>=5||row.reset_expires_at)return null;
   const expected=codeHash(pepper,id,pin);
   const actual=Buffer.isBuffer(row.code_digest)?row.code_digest:Buffer.from(row.code_digest);
   if(expected.length!==actual.length||!timingSafeEqual(expected,actual)){
    await tx.query('UPDATE public.barbernow_password_recovery SET attempts=attempts+1 WHERE id=$1',[id]);
    return null;
   }
   const resetToken=randomBytes(32).toString('base64url');
   await tx.query("UPDATE public.barbernow_password_recovery SET reset_token_digest=$2,reset_expires_at=now()+interval '5 minutes' WHERE id=$1",
    [id,tokenHash(resetToken)]);
   return {resetToken};
  });
  if(!out)failure(401,'Código incorrecto, vencido o ya utilizado');
  return out;
 }
 async function reset({resetToken,newPassword,ip}){
  const key=parseOrThrow(RESET,resetToken),password=parseOrThrow(PASSWORD,newPassword);
  await throttle('ip-reset',ip,20,3600);
  const claimed=await recoveryDb.query("UPDATE public.barbernow_password_recovery SET consumed_at=now(),reset_token_digest=NULL WHERE reset_token_digest=$1 AND consumed_at IS NULL AND reset_expires_at>now() RETURNING user_id",
   [tokenHash(key)]);
  if(!claimed.rowCount)failure(401,'El código de recuperación ya fue utilizado o venció');
  const {error}=await identityProvider.auth.admin.updateUserById(claimed.rows[0].user_id,{password});
  if(error)failure(503,'No se pudo actualizar la contraseña. Solicita un código nuevo.');
  return {ok:true};
 }
 return {start,verify,reset};
}
export async function registerPasswordRecoveryRoutes(app,{config,db,security,fetcher}){
 // All challenges live on the self-hosted PostgreSQL container, never on the old DB.
 if(!config.recoveryDatabaseUrl||!config.recoveryOtpSecret)return;
 const recoveryDb=createDb({...config,databaseUrl:config.recoveryDatabaseUrl,poolMax:3});
 if(!security.service)throw Error('Missing existing identity provider');
 const recover=createPasswordRecovery({
  recoveryDb,redis:security.redis,secret:config.recoveryOtpSecret,
  identityProvider:security.service,
  sendCode:createPasswordRecoverySender({config,db,fetcher})
 });
 const emailInput=z.object({email:EMAIL}).strict();
 const verifyInput=z.object({challengeId:ID,code:PIN}).strict();
 const resetInput=z.object({resetToken:RESET,newPassword:PASSWORD}).strict();
 app.post('/api/v1/auth/whatsapp/recovery/start',async req=>{
  await security.limited(req);
  return recover.start({...parseOrThrow(emailInput,req.body),ip:req.ip});
 });
 app.post('/api/v1/auth/whatsapp/recovery/verify',async req=>{
  await security.limited(req);
  return recover.verify({...parseOrThrow(verifyInput,req.body),ip:req.ip});
 });
 app.post('/api/v1/auth/whatsapp/recovery/reset',async req=>{
  await security.limited(req);
  return recover.reset({...parseOrThrow(resetInput,req.body),ip:req.ip});
 });
 app.addHook('onClose',async()=>{await recoveryDb.close();});
}