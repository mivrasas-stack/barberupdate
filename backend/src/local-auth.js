import {randomBytes,randomUUID,createHash} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {normalizeBookingPhone} from './whatsapp-cloud.js';

// Own database-backed, opaque sessions. Never accepts third-party JWTs.
const problem=(statusCode,message)=>Object.assign(new Error(message),{statusCode});
const digest=token=>createHash('sha256').update(token).digest();
const newToken=()=>randomBytes(32).toString('base64url');
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
const emailSchema=z.email().max(254);
const passwordSchema=z.string().min(12).max(128).refine(p=>Buffer.byteLength(p,'utf8')<=72,'Contraseña demasiado larga');
const userFields='id,email,encrypted_password,raw_user_meta_data,raw_app_meta_data,email_confirmed_at,created_at,last_sign_in_at,banned_until';
const selectUser='SELECT '+userFields+' FROM auth.users';
const dummyHash=bcrypt.hash('fake-password-never-used',12);
const normalizeEmail=v=>String(v||'').trim().toLowerCase();

function publicUser(row){
 return {id:row.id,email:row.email||'',user_metadata:row.raw_user_meta_data||{},
  app_metadata:row.raw_app_meta_data||{},email_confirmed_at:row.email_confirmed_at,
  created_at:row.created_at,last_sign_in_at:row.last_sign_in_at,banned_until:row.banned_until};
}

export function createLocalAuth({db,redis,otp}){
 if(!db)throw Error('Local authentication requires the PostgreSQL database');
 async function generateAction(tx,id,purpose){
  const key=newToken();
  await tx.query("INSERT INTO auth.action_tokens(user_id,token_hash,purpose,expires_at) VALUES($1,$2,$3,now()+interval '5 minutes')",
   [id,digest(key),purpose]);
  return key;
 }
 async function createSession(tx,user){
  const access=newToken(),refresh=newToken();
  await tx.query("INSERT INTO auth.sessions(user_id,access_token_hash,refresh_token_hash,access_expires_at,refresh_expires_at) VALUES($1,$2,$3,now()+interval '1 hour',now()+interval '30 days')",
   [user.id,digest(access),digest(refresh)]);
  await tx.query('UPDATE auth.users SET last_sign_in_at=now() WHERE id=$1',[user.id]);
  return {access_token:access,refresh_token:refresh,expires_in:3600,token_type:'bearer',user:publicUser(user)};
 }
 async function authenticate(access){
  if(!tokenPattern.test(String(access||'')))throw problem(401,'Sesión inválida');
  const q=await db.query("SELECT u.id,u.email,u.raw_user_meta_data,u.raw_app_meta_data,u.email_confirmed_at,u.created_at,u.last_sign_in_at,u.banned_until FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id WHERE s.access_token_hash=$1 AND s.access_expires_at>now() AND s.refresh_expires_at>now() AND s.revoked_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<now())",
   [digest(access)]);
  if(!q.rowCount)throw problem(401,'Sesión expirada o revocada');
  return publicUser(q.rows[0]);
 }
 async function throttle(address,ip){
  if(!redis)throw problem(503,'Límite de intentos no disponible');
  const key='barbernow:auth:login:'+createHash('sha256').update(address+'|'+ip).digest('hex');
  const n=await redis.incr(key);
  if(n===1)await redis.expire(key,900);
  if(n>8)throw problem(429,'Demasiados intentos de acceso');
  return ()=>redis.del(key);
 }
 async function login(address,password,ip){
  const parsed=emailSchema.safeParse(normalizeEmail(address));
  if(!parsed.success)throw problem(401,'Credenciales incorrectas');
  address=parsed.data;
  if(typeof password!=='string'||password.length>256)throw problem(401,'Credenciales incorrectas');
  const clear=await throttle(address,ip);
  const q=await db.query(selectUser+' WHERE lower(email)=$1',[address]);
  const user=q.rows[0],isValid=await bcrypt.compare(password,user?.encrypted_password||await dummyHash);
  if(!user||!isValid||!user.email_confirmed_at||(user.banned_until&&new Date(user.banned_until)>new Date()))
   throw problem(401,'Correo, contraseña o verificación incorrectos');
  await clear();
  return db.transaction(tx=>createSession(tx,user));
 }
 async function refresh(refreshToken){
  if(!tokenPattern.test(String(refreshToken||'')))throw problem(401,'Sesión inválida');
  return db.transaction(async tx=>{
   const q=await tx.query("SELECT s.id AS session_id,u.id,u.email,u.raw_user_meta_data,u.raw_app_meta_data,u.email_confirmed_at,u.created_at,u.last_sign_in_at,u.banned_until FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id WHERE s.refresh_token_hash=$1 AND s.refresh_expires_at>now() AND s.revoked_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<now()) FOR UPDATE OF s",
    [digest(refreshToken)]);
   if(!q.rowCount)throw problem(401,'Sesión revocada o expirada');
   const access=newToken(),next=newToken(),user=q.rows[0];
   await tx.query("UPDATE auth.sessions SET access_token_hash=$2,refresh_token_hash=$3,access_expires_at=now()+interval '1 hour',updated_at=now() WHERE id=$1",
    [user.session_id,digest(access),digest(next)]);
   return {access_token:access,refresh_token:next,expires_in:3600,token_type:'bearer',user:publicUser(user)};
  });
 }
 async function logout(access){
  if(tokenPattern.test(String(access||'')))await db.query('UPDATE auth.sessions SET revoked_at=now() WHERE access_token_hash=$1',[digest(access)]);
 }
 async function signup(address,password,metadata={},ip='unknown'){
  address=emailSchema.parse(normalizeEmail(address));
  password=passwordSchema.parse(password);
  if(!otp)throw problem(503,'Autenticación por WhatsApp no configurada');
  let phone;
  try{phone=normalizeBookingPhone(metadata.phone);}
  catch{throw problem(400,'Ingresa un celular colombiano de 10 dígitos');}
  if(!/^\+573[0-9]{9}$/.test(phone))throw problem(400,'Celular colombiano no válido');
  const existing=await db.query('SELECT 1 FROM auth.users WHERE phone_e164=$1 AND phone_verified_at IS NOT NULL LIMIT 1',[phone]);
  if(existing.rowCount)throw problem(409,'Este celular ya tiene una cuenta verificada');
  const hash=await bcrypt.hash(password,12);
  let user;
  try {
   user=await db.transaction(async tx=>{
    const q=await tx.query("INSERT INTO auth.users(email,encrypted_password,raw_user_meta_data,raw_app_meta_data,phone_e164) VALUES($1,$2,$3::jsonb,'{}'::jsonb,$4) RETURNING "+userFields,
     [address,hash,JSON.stringify({...metadata,phone:phone.slice(3)}),phone]);
    return q.rows[0];
   });
  }catch(e){
   if(e.code==='23505')throw problem(409,'La cuenta ya existe. Inicia sesión o recupera tu contraseña');
   throw e;
  }
  try{
   const challenge=await otp.start({userId:user.id,phone,purpose:'signup',ip});
   return {user:publicUser(user),...challenge,verification_required:true};
  }catch(e){
   await db.query('DELETE FROM auth.users WHERE id=$1 AND phone_verified_at IS NULL',[user.id]);
   throw e;
  }
 }
 async function resendSignup(address,password,ip='unknown'){
  if(!otp)throw problem(503,'WhatsApp no disponible');
  const parsed=emailSchema.safeParse(normalizeEmail(address));
  if(!parsed.success||typeof password!=='string')throw problem(401,'Solicitud inválida');
  const q=await db.query(selectUser+' WHERE lower(email)=$1 LIMIT 1',[parsed.data]);
  const user=q.rows[0];
  const valid=await bcrypt.compare(password,user?.encrypted_password||await dummyHash);
  if(!valid||!user||user.phone_verified_at||user.email_confirmed_at)
   throw problem(401,'No se pudo reenviar el código de activación');
  const phone=await db.query('SELECT phone_e164 FROM auth.users WHERE id=$1',[user.id]);
  if(!phone.rowCount||!phone.rows[0].phone_e164)throw problem(401,'Celular no asociado');
  return otp.start({userId:user.id,phone:phone.rows[0].phone_e164,purpose:'signup',ip});
 }
 async function recover(address,ip='unknown'){
  if(!otp)throw problem(503,'Autenticación por WhatsApp no configurada');
  const parsed=emailSchema.safeParse(normalizeEmail(address));
  if(!parsed.success)throw problem(400,'Correo inválido');
  const q=await db.query("SELECT id,phone_e164,phone_verified_at FROM auth.users WHERE lower(email)=$1 LIMIT 1",[parsed.data]);
  const u=q.rows[0];
  const response={message:'Si la cuenta tiene un celular verificado, recibirá un código por WhatsApp',
    challengeId:randomUUID(),expiresInSeconds:300,channel:'whatsapp'};
  if(!u?.phone_verified_at||!u.phone_e164)return response;
  try {
   const result=await otp.start({userId:u.id,phone:u.phone_e164,purpose:'recovery',ip});
   return {...response,...result};
  }catch(e){
   if(e.statusCode===429)throw e;
   return response;
  }
 }
 async function resetWithRecoveryToken(key,password){
  if(!tokenPattern.test(String(key||'')))throw problem(401,'Token de recuperación inválido');
  const valid=passwordSchema.parse(password);
  const hash=await bcrypt.hash(valid,12);
  const result=await db.transaction(async tx=>{
   const q=await tx.query("SELECT id,user_id FROM auth.action_tokens WHERE token_hash=$1 AND purpose='recover_password' AND consumed_at IS NULL AND expires_at>now() FOR UPDATE",
    [digest(key)]);
   if(!q.rowCount)return false;
   await tx.query('UPDATE auth.action_tokens SET consumed_at=now() WHERE id=$1',[q.rows[0].id]);
   await tx.query('UPDATE auth.users SET encrypted_password=$2,updated_at=now() WHERE id=$1',[q.rows[0].user_id,hash]);
   await tx.query('UPDATE auth.sessions SET revoked_at=now() WHERE user_id=$1',[q.rows[0].user_id]);
   return true;
  });
  if(!result)throw problem(401,'Enlace de recuperación vencido o utilizado');
  return {ok:true};
 }
 async function verifyOtp(input){
  if(!otp)throw problem(503,'Autenticación WhatsApp no configurada');
  return otp.verify(input);
 }
 async function update(userId,input){
  if(!input||typeof input!=='object'||'app_metadata' in input||'role' in input||'id' in input)throw problem(403,'No puedes modificar permisos');
  if(input.email!==undefined)throw problem(409,'El cambio de correo requiere verificación por separado');
  const clauses=[],args=[userId];
  if(input.data!==undefined){
   if(typeof input.data!=='object'||input.data===null||Array.isArray(input.data))throw problem(400,'Perfil inválido');
   clauses.push("raw_user_meta_data=COALESCE(raw_user_meta_data,'{}'::jsonb)||$"+(args.length+1)+"::jsonb");
   args.push(JSON.stringify(input.data));
  }
  if(input.password!==undefined){
   const valid=passwordSchema.parse(input.password);
   clauses.push('encrypted_password=$'+(args.length+1));
   args.push(await bcrypt.hash(valid,12));
  }
  if(!clauses.length)throw problem(400,'Sin cambios');
  const q=await db.query('UPDATE auth.users SET '+clauses.join(',')+',updated_at=now() WHERE id=$1 RETURNING '+userFields,args);
  if(!q.rowCount)throw problem(404,'Usuario no encontrado');
  if(input.password!==undefined)await db.query('UPDATE auth.sessions SET revoked_at=now() WHERE user_id=$1',[userId]);
  return publicUser(q.rows[0]);
 }
 async function acceptWhatsAppInvite({challengeId,code,password}){
  if(!otp)throw problem(503,'WhatsApp no disponible');
  const hashed=await bcrypt.hash(passwordSchema.parse(password),12);
  const confirmed=await otp.verify({challengeId,code,purpose:'signup',setupPasswordHash:hashed});
  const row=await db.query(selectUser+' WHERE id=$1',[confirmed.userId]);
  if(!row.rowCount)throw problem(401,'Invitación inválida');
  return db.transaction(tx=>createSession(tx,row.rows[0]));
 }
 async function phoneStatus(userId){
  const q=await db.query('SELECT phone_e164,phone_verified_at FROM auth.users WHERE id=$1 LIMIT 1',[userId]);
  const row=q.rows[0];
  return {verified:Boolean(row?.phone_verified_at),phoneLast4:row?.phone_verified_at?String(row.phone_e164||'').slice(-4):null};
 }
 async function adminGetUserById(id){
  const q=await db.query(selectUser+' WHERE id=$1 LIMIT 1',[id]);
  return q.rowCount?{data:{user:publicUser(q.rows[0])},error:null}:{data:{user:null},error:{message:'Usuario no encontrado'}};
 }
 async function adminListUsers({page=1,perPage=200}={}){
  const limit=Math.min(200,Math.max(1,Number(perPage)||200));
  const q=await db.query(selectUser+' ORDER BY created_at LIMIT $1 OFFSET $2',[limit,(Math.max(1,Number(page)||1)-1)*limit]);
  return {data:{users:q.rows.map(publicUser)},error:null};
 }
 async function adminInviteUserByEmail(address,{data={}}={}){
  if(!otp)return {data:null,error:{message:'WhatsApp no disponible'}};
  const parsed=emailSchema.safeParse(normalizeEmail(address));
  if(!parsed.success)return {data:null,error:{message:'Correo inválido'}};
  let phone;
  try{phone=normalizeBookingPhone(data.phone);}
  catch{return {data:null,error:{message:'Se necesita el celular del usuario para invitarlo por WhatsApp'}};}
  let createdUser=null;
  try{
   createdUser=await db.transaction(async tx=>{
    const q=await tx.query("INSERT INTO auth.users(email,phone_e164,raw_user_meta_data,raw_app_meta_data) VALUES($1,$2,$3::jsonb,'{}'::jsonb) RETURNING "+userFields,
     [parsed.data,phone,JSON.stringify(data)]);
    return q.rows[0];
   });
   const challenge=await otp.start({userId:createdUser.id,phone,purpose:'signup',ip:'platform-invite'});
   return {data:{user:publicUser(createdUser),challenge},error:null};
  }catch{
   // An unavailable Meta API must not leave an unusable invited identity.
   if(createdUser)await db.query("DELETE FROM auth.users WHERE id=$1 AND encrypted_password IS NULL AND phone_verified_at IS NULL",
     [createdUser.id]).catch(()=>{});
   return {data:null,error:{message:'No se pudo enviar la invitación por WhatsApp'}};
  }
 }
 return {
  authenticate,login,refresh,logout,signup,resendSignup,verifyOtp,recover,resetWithRecoveryToken,acceptWhatsAppInvite,phoneStatus,update,
  service:{auth:{admin:{
   listUsers:adminListUsers,getUserById:adminGetUserById,inviteUserByEmail:adminInviteUserByEmail
  }}}
 };
}

[executed on device: vmi3669516 (22a9c8cd-8866-4186-9071-dab9301dff16)]