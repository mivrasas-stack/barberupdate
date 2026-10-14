import React,{useEffect,useState} from 'react';
import {ArrowRight,CheckCircle2,LockKeyhole,Scissors} from 'lucide-react';
import {hasSession,signIn,registerWithEmail,linkCustomer,resolveBusinessLink,
 type PublicBusinessLink} from '../../services/liveBackend';

/** Public QR entry point: a visible authenticated opt-in, never a privileged token. */
export const PublicJoinView:React.FC=()=>{
 const code=decodeURIComponent(location.pathname.split('/')[2]||'').trim().toUpperCase();
 const [target,setTarget]=useState<PublicBusinessLink|null>(null);
 const [error,setError]=useState('');
 const [status,setStatus]=useState('');
 const [mode,setMode]=useState<'register'|'login'>('register');
 const [busy,setBusy]=useState(false);
 const [name,setName]=useState('');
 const [phone,setPhone]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [consent,setConsent]=useState(false);
 const [existingSession]=useState(hasSession);
 useEffect(()=>{
   let alive=true;
   resolveBusinessLink(code).then(data=>{if(alive)setTarget(data)})
     .catch(e=>{if(alive)setError(e instanceof Error?e.message:'QR no válido')});
   return()=>{alive=false};
 },[code]);
 const join=async(e:React.FormEvent)=>{
   e.preventDefault();
   if(busy||!target)return;
   if(mode==='register'&&password!==confirm){setError('Las contraseñas no coinciden');return}
   if(mode==='register'&&!consent){setError('Confirma que deseas asociarte a este negocio');return}
   setBusy(true);setError('');setStatus('');
   try{
     if(!existingSession){
       if(mode==='register'){
         await registerWithEmail(email.trim(),password);
         try{await signIn(email.trim(),password)}
         catch{
           setStatus('Cuenta creada. Confirma tu correo electrónico si Supabase lo solicita y luego usa “Ya tengo cuenta” aquí para terminar tu vinculación.');
           setMode('login');return;
         }
       }else await signIn(email.trim(),password);
     }
     const result=await linkCustomer(code,name.trim(),phone.trim());
     setStatus('¡Te vinculaste con '+result.name+'! Entrando a tu portal...');
     window.location.replace('/login#/clientes/inicio');
   }catch(err){setError(err instanceof Error?err.message:'No pudimos completar el registro')}
   finally{setBusy(false)}
 };
 return <main className="min-h-screen bg-[#090909] px-4 py-10 text-white">
  <div className="mx-auto max-w-xl">
   <a href="/" className="text-[var(--gold-primary)] font-bold text-xs">← Barber Paradise</a>
   <div className="mt-7 border border-[#303030] bg-[#151515] rounded-3xl p-6 sm:p-9 shadow-2xl">
    <div className="mx-auto w-14 h-14 bg-[var(--gold-primary)] rounded-2xl text-black flex items-center justify-center mb-5"><Scissors className="w-7 h-7"/></div>
    <div className="text-center">
      <p className="text-xs text-[var(--gold-primary)] uppercase font-semibold tracking-widest">Vinculación por código QR</p>
      <h1 className="text-2xl font-black mt-2">{target?.name||'Conectando con tu barbería...'}</h1>
      <p className="text-neutral-400 text-sm mt-2">{target?.business_kind==='independent'?'Únete al espacio de tu barbero independiente.':'Únete a tu barbería, consulta tus reservas y mantén tus establecimientos asociados.'}</p>
      {target?.barber_name&&<p className="text-[var(--gold-primary)] text-xs mt-2">{target.barber_name}</p>}
    </div>
    {error&&<p role="alert" className="my-5 rounded-xl border border-red-600/30 bg-red-950/40 p-3 text-red-200 text-sm">{error}</p>}
    {status&&<p role="status" className="my-5 rounded-xl border border-emerald-600/30 bg-emerald-950/40 p-3 text-emerald-200 text-sm">{status}</p>}
    {target&&<form className="mt-7 space-y-4" onSubmit={e=>void join(e)}>
      {!existingSession&&<div className="flex gap-2 rounded-xl bg-[#202020] p-1 text-sm">
        <button type="button" onClick={()=>setMode('register')} className={'flex-1 rounded-lg p-2 '+(mode==='register'?'bg-[var(--gold-primary)] text-black font-bold':'text-neutral-400')}>Crear cuenta</button>
        <button type="button" onClick={()=>setMode('login')} className={'flex-1 rounded-lg p-2 '+(mode==='login'?'bg-[var(--gold-primary)] text-black font-bold':'text-neutral-400')}>Ya tengo cuenta</button>
      </div>}
      <div><label htmlFor="join-name" className="block text-xs text-neutral-300 mb-2">Nombre y apellidos completos</label>
       <input id="join-name" required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-xl border border-neutral-700 bg-[#101010] px-4 py-3 text-sm" placeholder="Tu nombre completo"/></div>
      <div><label htmlFor="join-phone" className="block text-xs text-neutral-300 mb-2">Teléfono de contacto</label>
       <input id="join-phone" required minLength={7} maxLength={32} autoComplete="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full rounded-xl border border-neutral-700 bg-[#101010] px-4 py-3 text-sm" placeholder="+57 300 123 4567"/></div>
      {!existingSession&&<>
       <div><label htmlFor="join-email" className="block text-xs text-neutral-300 mb-2">Correo electrónico</label>
        <input id="join-email" required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-xl border border-neutral-700 bg-[#101010] px-4 py-3 text-sm" placeholder="tu@correo.com"/></div>
       <div><label htmlFor="join-password" className="block text-xs text-neutral-300 mb-2">Contraseña {mode==='register'?'(mínimo 8 caracteres)':''}</label>
        <input id="join-password" required type="password" autoComplete={mode==='register'?'new-password':'current-password'} minLength={mode==='register'?8:undefined} value={password} onChange={e=>setPassword(e.target.value)} className="w-full rounded-xl border border-neutral-700 bg-[#101010] px-4 py-3 text-sm"/></div>
       {mode==='register'&&<div><label htmlFor="join-confirm" className="block text-xs text-neutral-300 mb-2">Confirmar contraseña</label>
        <input id="join-confirm" required type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)} className="w-full rounded-xl border border-neutral-700 bg-[#101010] px-4 py-3 text-sm"/></div>}
      </>}
      {mode==='register'&&<label className="flex items-start gap-3 text-xs text-neutral-400"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1 accent-amber-400"/><span>Acepto vincular mi cuenta con {target.name} y compartir con ese negocio los datos necesarios para gestionar mis citas.</span></label>}
      <button disabled={busy} className="w-full rounded-xl py-3.5 bg-[var(--gold-primary)] text-black font-extrabold text-sm flex justify-center items-center gap-2 disabled:opacity-50">{busy?'Procesando...':existingSession?'Confirmar vinculación':mode==='register'?'Registrarme y vincular':'Ingresar y vincular'} <ArrowRight className="w-4 h-4"/></button>
      <p className="text-center text-xs text-neutral-500"><LockKeyhole className="w-3 h-3 inline-block mr-1"/>Tu contraseña se verifica con Supabase Auth, no se guarda en la barbería.</p>
    </form>}
    {status.startsWith('¡')&&<CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mt-5"/>}
   </div>
  </div>
 </main>;
};
