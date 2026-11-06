import {z} from 'zod';
import {parseOrThrow,failure} from './security.js';
const email=z.email().max(254);
const challengeId=z.uuid();
const code=z.string().regex(/^[0-9]{8}$/);
const bearer=z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const signup=z.object({
 email,password:z.string().min(12).max(128),
 data:z.object({full_name:z.string().trim().min(2).max(120).optional(),
  phone:z.string().trim().min(10).max(25)}).strict()
}).strict();
const login=z.object({email,password:z.string()}).strict();
const codeInput=z.object({challengeId,code,purpose:z.enum(['signup','recovery','link'])}).strict();
const recoverInput=z.object({email}).strict();
const linkInput=z.object({phone:z.string().trim().min(10).max(25)}).strict();
const resetInput=z.object({recoveryToken:bearer,password:z.string().min(12).max(128)}).strict();
const updateInput=z.object({
 data:z.record(z.string(),z.unknown()).optional(),
 email:email.optional(),
 password:z.string().min(12).max(128).optional()
}).strict();

export async function registerLocalAuthRoutes(app,{localAuth,otp,security}){
 const {limited,authenticated}=security;
 app.register(async auth=>{
  auth.addHook('preHandler',limited);
  auth.post('/api/v1/auth/token',async req=>{
   const grant=String(req.query?.grant_type||'');
   if(grant==='password'){
    const x=parseOrThrow(login,req.body);
    return localAuth.login(x.email,x.password,req.ip);
   }
   if(grant==='refresh_token'){
    const x=parseOrThrow(z.object({refresh_token:bearer}).strict(),req.body);
    return localAuth.refresh(x.refresh_token);
   }
   failure(400,'Tipo de sesión desconocido');
  });
  auth.post('/api/v1/auth/signup',async(req,reply)=>{
   const x=parseOrThrow(signup,req.body);
   return reply.code(201).send(await localAuth.signup(x.email,x.password,x.data,req.ip));
  });
  auth.post('/api/v1/auth/whatsapp/resend',async req=>{
   const x=parseOrThrow(login,req.body);
   return localAuth.resendSignup(x.email,x.password,req.ip);
  });
  auth.post('/api/v1/auth/recover',async req=>{
   const x=parseOrThrow(recoverInput,req.body);
   return localAuth.recover(x.email,req.ip);
  });
  auth.post('/api/v1/auth/whatsapp/verify',async req=>{
   const x=parseOrThrow(codeInput,req.body);
   if(x.purpose==='link'){
    await authenticated(req);
    return localAuth.verifyOtp({...x,expectedUserId:req.actor.id});
   }
   return localAuth.verifyOtp(x);
  });
  auth.get('/api/v1/auth/whatsapp/status',async req=>{
   await authenticated(req);
   return localAuth.phoneStatus(req.actor.id);
  });
  auth.post('/api/v1/auth/whatsapp/link',async req=>{
   await authenticated(req);
   const x=parseOrThrow(linkInput,req.body);
   return otp.start({userId:req.actor.id,phone:x.phone,purpose:'link',ip:req.ip});
  });
  auth.post('/api/v1/auth/whatsapp/invite-accept',async req=>{
   const x=parseOrThrow(z.object({challengeId,code,password:z.string().min(12).max(128)}).strict(),req.body);
   return localAuth.acceptWhatsAppInvite(x);
  });
  auth.post('/api/v1/auth/whatsapp/reset',async req=>{
   const x=parseOrThrow(resetInput,req.body);
   return localAuth.resetWithRecoveryToken(x.recoveryToken,x.password);
  });
  auth.get('/api/v1/auth/user',async req=>{
   await authenticated(req);
   return localAuth.authenticate(req.headers.authorization.slice(7));
  });
  auth.put('/api/v1/auth/user',async req=>{
   await authenticated(req);
   return localAuth.update(req.actor.id,parseOrThrow(updateInput,req.body));
  });
  auth.post('/api/v1/auth/logout',async req=>{
   const match=/^Bearer (.+)$/i.exec(req.headers.authorization||'');
   await localAuth.logout(match?.[1]||'');
   return {ok:true};
  });
 });
}