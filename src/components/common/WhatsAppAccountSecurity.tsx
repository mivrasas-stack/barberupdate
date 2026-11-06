import React,{useEffect,useState} from 'react';
import {backendRequest,requestPhoneVerification,confirmPhoneVerification,isLiveBackend} from '../../services/liveBackend';
import {ShieldCheck} from 'lucide-react';

/** Phone ownership is verified only by a one-use WhatsApp OTP, never by editing profile text. */
export const WhatsAppAccountSecurity:React.FC<{phone:string;notify:(text:string,type:'success'|'error'|'info')=>void}>=({phone,notify})=>{
 const [verified,setVerified]=useState(false);
 const [last4,setLast4]=useState<string|null>(null);
 const [challenge,setChallenge]=useState('');
 const [code,setCode]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!isLiveBackend)return;
  let active=true;
  backendRequest<{verified:boolean;phoneLast4:string|null}>('/auth/whatsapp/status')
   .then(x=>{if(active){setVerified(x.verified);setLast4(x.phoneLast4);}})
   .catch(()=>{});
  return()=>{active=false};
 },[]);
 const send=async()=>{
  setBusy(true);
  try{
   const result=await requestPhoneVerification(phone);
   if(!result.challengeId)throw Error('WhatsApp no pudo generar el código');
   setChallenge(result.challengeId);setCode('');
   notify('Enviamos un código a tu WhatsApp. Expira en cinco minutos.','success');
  }catch(e){notify(e instanceof Error?e.message:'No se pudo enviar el código','error');}
  finally{setBusy(false);}
 };
 const verify=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);
  try{
   await confirmPhoneVerification(challenge,code);
   setVerified(true);setLast4(phone.replace(/\D/g,'').slice(-4));setChallenge('');
   notify('Celular verificado. Puedes recuperar tu cuenta por WhatsApp.','success');
  }catch(error){notify(error instanceof Error?error.message:'Código inválido','error');}
  finally{setBusy(false);}
 };
 if(!isLiveBackend)return null;
 return <section className="space-y-3 rounded-2xl border border-[#303030] bg-[#141414] p-5 sm:p-6">
  <h2 className="flex items-center gap-2 text-sm font-bold text-white"><ShieldCheck className="h-4 w-4 text-[var(--gold-primary)]"/>
   Seguridad de mi cuenta
  </h2>
  <p className="text-xs leading-relaxed text-neutral-400">
   {verified
    ?'Tu WhatsApp terminado en '+(last4||'****')+' ya está verificado para recuperar tu cuenta.'
    :'Verifica tu celular una vez para poder recuperar el acceso por WhatsApp, sin correos.'}
  </p>
  {!challenge&&<button type="button" onClick={()=>void send()} disabled={busy||!phone.trim()}
    className="rounded-xl border border-[var(--gold-primary)] px-4 py-3 text-xs font-bold text-[var(--gold-primary)] disabled:opacity-50">
    {busy?'Enviando...':verified?'Cambiar celular verificado':'Verificar mi WhatsApp'}
  </button>}
  {challenge&&<form onSubmit={e=>void verify(e)} className="space-y-3">
   <label className="block text-xs text-neutral-300">Código recibido (8 dígitos)
    <input type="text" required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{8}"
      maxLength={8} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}
      className="mt-2 w-full rounded-xl border border-neutral-700 bg-[#101010] px-4 py-3 text-center font-mono text-xl tracking-widest"/>
   </label>
   <button disabled={busy} type="submit" className="rounded-xl bg-[var(--gold-primary)] px-5 py-3 text-sm font-bold text-black disabled:opacity-50">
    {busy?'Comprobando...':'Confirmar código'}
   </button>
   <button type="button" onClick={()=>{setChallenge('');setCode('');}} className="ml-3 text-xs text-neutral-400">Cancelar</button>
  </form>}
 </section>;
};