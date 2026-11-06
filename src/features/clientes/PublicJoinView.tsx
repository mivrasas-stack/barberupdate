import React,{useEffect,useState} from 'react';
import {ArrowRight,CheckCircle2,LockKeyhole} from 'lucide-react';
import {hasSession,signIn,registerWithEmail,verifyWhatsAppAuthCode,resendWhatsAppAuthCode,linkCustomer,resolveBusinessLink,
 type PublicBusinessLink} from '../../services/liveBackend';

/** Public QR entry point: a visible authenticated opt-in, never a privileged token. */
export const PublicJoinView:React.FC=()=>{
 const code=decodeURIComponent(location.pathname.split('/')[2]||'').trim().toUpperCase();
 const barberId=new URLSearchParams(location.search).get('barberId')||undefined;
 const [target,setTarget]=useState<PublicBusinessLink|null>(null);
 const [error,setError]=useState('');
 const [status,setStatus]=useState('');
 const [mode,setMode]=useState<'register'|'login'|'profile'>('register');
 const [busy,setBusy]=useState(false);
 const [name,setName]=useState('');
 const [phone,setPhone]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [otpChallenge,setOtpChallenge]=useState('');
 const [otpCode,setOtpCode]=useState('');
 const [confirm,setConfirm]=useState('');
 const [consent,setConsent]=useState(false);
 const [existingSession]=useState(hasSession);
 useEffect(()=>{
   let alive=true;
   resolveBusinessLink(code,barberId).then(data=>{if(alive)setTarget(data)})
     .catch(e=>{if(alive)setError(e instanceof Error?e.message:'QR no válido')});
   return()=>{alive=false};
 },[code,barberId]);
 const join=async(e:React.FormEvent)=>{
   e.preventDefault();
   if(busy||!target)return;
   if(mode==='register'&&password!==confirm){setError('Las contraseñas no coinciden');return}
   if(mode==='register'&&!consent){setError('Confirma que deseas asociarte a este negocio');return}
   setBusy(true);setError('');setStatus('');
   try{
     if(otpChallenge){
       if(!/^\d{8}$/.test(otpCode))throw Error('Introduce los 8 dígitos recibidos por WhatsApp');
       await verifyWhatsAppAuthCode(otpChallenge,otpCode,'signup');
       await signIn(email.trim(),password);
       const linked=await linkCustomer(code,name.trim(),phone.trim(),barberId);
       setStatus('¡Te vinculaste con '+linked.name+'! Entrando a tu portal...');
       window.location.replace('/login#/clientes/inicio');
       return;
     }
     if(!existingSession&&mode!=='profile'){
       if(mode==='register'){
         const started=await registerWithEmail(email.trim(),password,{fullName:name.trim(),phone:phone.trim()});
         if(!started.challengeId)throw Error('WhatsApp no pudo iniciar la verificación.');
         setOtpChallenge(started.challengeId);
         setStatus('Te enviamos un código por WhatsApp. Escríbelo para confirmar tu cuenta y vincularte al negocio.');
         return;
       }else await signIn(email.trim(),password);
     }
     if(!existingSession&&mode!=='profile'){setMode('profile');setStatus('Sesi�n iniciada. Completa tus datos para vincularte.');return;}
     const result=await linkCustomer(code,name.trim(),phone.trim(),barberId);
     setStatus('¡Te vinculaste con '+result.name+'! Entrando a tu portal...');
     window.location.replace('/login#/clientes/inicio');
   }catch(err){setError(err instanceof Error?err.message:'No pudimos completar el registro')}
   finally{setBusy(false)}
 };
 return <main className="min-h-screen bg-[#090909] px-4 py-10 text-white">
  <div className="mx-auto max-w-xl">
   <a href="/" className="text-[var(--gold-primary)] font-bold text-xs">← BarberNow</a>
   <div className="mt-7 border border-[#303030] bg-[#151515] rounded-3xl p-6 sm:p-9 shadow-2xl">
    <img src="/branding/barbernow-logo.png" alt="BarberNow" className="mx-auto mb-5 h-20 w-auto object-contain" draggable={false}/>
    <div className="text-center">
      <p className="text-xs text-[var(--gold-primary)] uppercase font-semibold tracking-widest">Vinculación por código QR</p>
      <h1 className="text-2xl font-black mt-2">{target?.name||'Conectando con tu barbería...'}</h1>
      <p className="text-neutral-400 text-sm mt-2">{target?.business_kind==='independent'?'Únete al espacio de tu barbero independiente.':'Únete a tu barbería, consulta tus reservas y mantén tus establecimientos asociados.'}</p>
      {target?.barber_name&&<p className="text-[var(--gold-primary)] text-xs mt-2">{target.barber_name}</p>}
    </div>
    {error&&<p role="alert" className="my-5 rounded-xl border border-red-600/30 bg-red-950/40 p-3 text-red-200 text-sm">{error}</p>}
    {status&&<p role="status" className="my-5 rounded-xl border border-emerald-600/30 bg-emerald-950/40 p-3 text-emerald-200 text-sm">{status}</p>}
    {target&&<form className="mt-7 space-y-4" onSubmit={e=>void join(e)}>
      {!existingSession&&mode!=='profile'&&!otpChallenge&&<div className="flex gap-2 rounded-xl bg-[#202020] p-1 text-sm">
        <button type="button" onClick={()=>setMode('register')} className={'flex-1 rounded-lg p-2 '+(mode==='register'?'bg-[var(--gold-primary)] text-black font-bold':'text-neutral-400')}>Crear cuenta</button>
        <button type="button" onClick={()=>setMode('login')} className={'flex-1 rounded-lg p-2 '+(mode==='login'?'bg-[var(--gold-primary)] text-black font-bold':'text-neutral-400')}>Ya tengo cuenta</button>
      </div>}
      {!otpChallenge&&(mode==='register'||mode==='profile'||existingSession)&&<><div><label htmlFor="join-name" className="block text-xs text-neutral-300 mb-2">Nombre y apellidos completos</label>
       <input id="join-name" required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-xl border border-neutral-700 bg-[#101010] px-4 py-3 text-sm" placeholder="Tu nombre completo"/></div>
      <div><label htmlFor="join-phone" className="block text-xs text-neutral-300 mb-2">Teléfono de contacto</label>
       <input id="join-phone" required minLength={7} maxLength={32} autoComplete="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full rounded-xl border border-neutral-700 bg-[#101010] px-4 py-3 text-sm" placeholder="3001234567"/></div>
      </>}
      {!existingSession&&mode!=='profile'&&!otpChallenge&&<>
       <div><label htmlFor="join-email" className="block text-xs text-neutral-300 mb-2">Correo electrónico</label>
        <input id="join-email" required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-xl border border-neutral-700 bg-[#101010] px-4 py-3 text-sm" placeholder="tu@correo.com"/></div>
       <div><label htmlFor="join-password" className="block text-xs text-neutral-300 mb-2">Contraseña {mode==='register'?'(mínimo 12 caracteres)':''}</label>
        <input id="join-password" required type="password" autoComplete={mode==='register'?'new-password':'current-password'} minLength={mode==='register'?12:undefined} value={password} onChange={e=>setPassword(e.target.value)} className="w-full rounded-xl border border-neutral-700 bg-[#101010] px-4 py-3 text-sm"/></div>
       {mode==='register'&&<div><label htmlFor="join-confirm" className="block text-xs text-neutral-300 mb-2">Confirmar contraseña</label>
        <input id="join-confirm" required type="password" autoComplete="new-password" minLength={12} value={confirm} onChange={e=>setConfirm(e.target.value)} className="w-full rounded-xl border border-neutral-700 bg-[#101010] px-4 py-3 text-sm"/></div>}
      </>}
      {mode==='register'&&!otpChallenge&&<label className="flex items-start gap-3 text-xs text-neutral-400"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1 accent-amber-400"/><span>Acepto vincular mi cuenta con {target.name} y compartir con ese negocio los datos necesarios para gestionar mis citas.</span></label>}
      {otpChallenge&&<label className="block text-sm text-neutral-300">
        Código de WhatsApp (8 dígitos)
        <input type="text" required inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]{8}" maxLength={8} value={otpCode} onChange={e=>setOtpCode(e.target.value.replace(/\D/g,''))}
          className="mt-2 w-full rounded-xl border border-neutral-700 bg-[#101010] px-4 py-4 text-center font-mono text-2xl tracking-widest"
          placeholder="12345678"/>
        <small className="mt-2 block text-xs text-neutral-500">Expira en 5 minutos. No compartas este código.</small>
      </label>}
      {otpChallenge&&<button type="button" disabled={busy}
        onClick={async()=>{
          setBusy(true);
          try{
            const next=await resendWhatsAppAuthCode(email.trim(),password);
            if(next.challengeId){setOtpChallenge(next.challengeId);setOtpCode('');setStatus('Te enviamos otro código por WhatsApp.');}
          }catch(err){setError(err instanceof Error?err.message:'No se pudo reenviar el código');}
          finally{setBusy(false);}
        }} className="w-full text-sm font-semibold text-[var(--gold-primary)] disabled:opacity-50">
        Reenviar código
      </button>}
      <button disabled={busy} className="w-full rounded-xl py-3.5 bg-[var(--gold-primary)] text-black font-extrabold text-sm flex justify-center items-center gap-2 disabled:opacity-50">{busy?'Procesando...':existingSession?'Confirmar vinculación':otpChallenge?'Verificar código y vincular':mode==='register'?'Registrarme y vincular':mode==='profile'?'Confirmar vinculaci�n':'Ingresar y continuar'} <ArrowRight className="w-4 h-4"/></button>
      <p className="text-center text-xs text-neutral-500"><LockKeyhole className="w-3 h-3 inline-block mr-1"/>Tu contraseña se verifica en BarberNow. El código de acceso se envía por WhatsApp.</p>
    </form>}
    {status.startsWith('¡')&&<CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mt-5"/>}
   </div>
  </div>
 </main>;
};

[executed on device: vmi3669516 (22a9c8cd-8866-4186-9071-dab9301dff16)]