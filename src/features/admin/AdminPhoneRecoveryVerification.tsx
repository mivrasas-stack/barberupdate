import React,{useEffect,useState} from 'react';
import {ShieldCheck,MessageCircle,AlertTriangle} from 'lucide-react';
import {backendRequest} from '../../services/liveBackend';

type RecoveryStatus={
 phoneValid:boolean;
 phoneVerified:boolean;
 sharedWithOthers:number;
 recoveryEligible:boolean;
};

/** Superadmin-assisted phone ownership verification.
 * When legacy profiles share a phone, only a verified account may use it to
 * recover its password. We never select the account automatically by phone.
 */
export const AdminPhoneRecoveryVerification:React.FC<{
 userId:string;
 notify:(message:string,type:'success'|'error'|'info')=>void;
}>=({userId,notify})=>{
 const [status,setStatus]=useState<RecoveryStatus|null>(null);
 const [challenge,setChallenge]=useState('');
 const [code,setCode]=useState('');
 const [busy,setBusy]=useState(false);
 const [cooldown,setCooldown]=useState(0);
 const [error,setError]=useState('');
 const prefix='/platform/users/'+encodeURIComponent(userId)+'/whatsapp/';
 const reload=async()=>{
  const value=await backendRequest<RecoveryStatus>(prefix+'recovery-status');
  setStatus(value);
 };
 useEffect(()=>{
  let alive=true;
  backendRequest<RecoveryStatus>(prefix+'recovery-status')
    .then(value=>{if(alive)setStatus(value);})
    .catch(()=>{if(alive)setError('No se pudo comprobar el estado de recuperación por WhatsApp.')});
  return()=>{alive=false};
 },[userId]);
 useEffect(()=>{
  if(cooldown<=0)return;
  const timeout=window.setTimeout(()=>setCooldown(c=>Math.max(0,c-1)),1000);
  return()=>window.clearTimeout(timeout);
 },[cooldown]);
 const send=async()=>{
  if(busy||cooldown>0)return;
  setBusy(true);setError('');
  try{
   const result=await backendRequest<{challengeId:string;expiresInSeconds:number}>(
    prefix+'verify/start',{method:'POST'});
   setChallenge(result.challengeId);setCode('');setCooldown(60);
   notify('Se solicitó un código al WhatsApp registrado. Pídelo al titular de ese número.','info');
  }catch(e){setError(e instanceof Error?e.message:'No se pudo enviar el código');}
  finally{setBusy(false);}
 };
 const confirm=async(e:React.FormEvent)=>{
  e.preventDefault();
  if(busy||!/^[0-9]{8}$/.test(code))return;
  setBusy(true);setError('');
  try{
   await backendRequest(prefix+'verify/confirm',{
    method:'POST',body:JSON.stringify({challengeId:challenge,code})
   });
   setChallenge('');setCode('');setCooldown(0);
   await reload();
   notify('WhatsApp verificado para esta cuenta. Ya puede recuperar su contraseña por código.','success');
  }catch(e){setError(e instanceof Error?e.message:'Código incorrecto');}
  finally{setBusy(false);}
 };
 return <section className="sm:col-span-2 rounded-xl border border-[#303030] bg-[#171717] p-4 space-y-3"
   aria-label="Seguridad WhatsApp de la cuenta">
  <h4 className="flex items-center gap-2 text-xs font-bold text-white">
   <ShieldCheck className="h-4 w-4 text-[var(--gold-primary)]"/> Recuperación por WhatsApp
  </h4>
  {!status&&!error&&<p className="text-xs text-neutral-400">Comprobando el número registrado…</p>}
  {status&&<>
   {!status.phoneValid?
    <p className="text-xs text-amber-300">Este usuario no tiene un celular colombiano válido registrado. Primero debe corregirlo en su perfil.</p>:
    <>
     {status.phoneVerified?
      <p className="text-xs text-emerald-300">WhatsApp verificado para este usuario.</p>:
      <p className="text-xs text-neutral-300">El celular registrado todavía no tiene verificación exclusiva para recuperar esta cuenta.</p>}
     {status.sharedWithOthers>0&&<div className="flex items-start gap-2 text-xs text-amber-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>
      <span>Este mismo celular figura en {status.sharedWithOthers} {status.sharedWithOthers===1?'cuenta activa adicional':'cuentas activas adicionales'}.
       Para evitar que una persona restablezca varias contraseñas, verifica cuál cuenta debe ser dueña de este WhatsApp.</span>
     </div>}
     {status.recoveryEligible&&<p className="text-xs text-emerald-300">
      <ShieldCheck className="h-3.5 w-3.5 inline mr-1"/>Esta cuenta está habilitada para recuperar su contraseña por WhatsApp.
     </p>}
     {!challenge&&!status.phoneVerified&&<button type="button" disabled={busy||cooldown>0}
      onClick={()=>void send()}
      className="inline-flex items-center gap-2 rounded-lg border border-[var(--gold-primary)]/50 px-3 py-2 text-xs font-semibold text-[var(--gold-primary)] disabled:opacity-50">
      <MessageCircle className="h-4 w-4"/>
      {cooldown>0?'Solicitar otro código ('+cooldown+' s)':'Verificar WhatsApp de esta cuenta'}
     </button>}
    </>}
  </>}
  {challenge&&<form onSubmit={e=>void confirm(e)} className="rounded-xl border border-neutral-600/40 p-3 space-y-3">
   <p className="text-xs text-neutral-300">Introduce los 8 dígitos que reciba el titular en su WhatsApp. Expira en 5 minutos; no compartas el código públicamente.</p>
   <label htmlFor={'admin-whatsapp-code-'+userId} className="block text-xs text-neutral-300">Código recibido</label>
   <input id={'admin-whatsapp-code-'+userId} type="text" required inputMode="numeric"
     pattern="[0-9]{8}" maxLength={8} autoComplete="one-time-code"
     value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}
     className="w-full rounded-lg border border-neutral-600 bg-[#101010] px-3 py-3 text-center text-xl tracking-widest font-mono"/>
   <div className="flex flex-wrap gap-3">
    <button type="submit" disabled={busy||code.length!==8}
      className="rounded-lg bg-[var(--gold-primary)] px-4 py-2 text-xs font-bold text-black disabled:opacity-50">Confirmar WhatsApp</button>
    <button type="button" onClick={()=>{setChallenge('');setCode('');setError('');}}
      className="px-3 py-2 text-xs text-neutral-300">Cancelar</button>
   </div>
  </form>}
  {error&&<p role="alert" className="text-xs text-red-300">{error}</p>}
 </section>;
};