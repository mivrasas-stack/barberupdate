import React,{useEffect,useState} from 'react';
import {hasSession,signIn,registerWithEmail,backendRequest} from '../../services/liveBackend';
export function BarberJoinPublic(){
 const code=location.pathname.split('/')[2]||'';
 const [target,setTarget]=useState(''),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[mode,setMode]=useState<'login'|'register'>('login'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{fetch('/api/v1/public/barber-invites/'+encodeURIComponent(code)).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setTarget(d.name);}).catch(e=>setMessage(String(e)));},[code]);
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);setMessage('');
  try{
   if(!hasSession()){
    if(mode==='register'){await registerWithEmail(email,password);setMode('login');setMessage('Cuenta creada. Confirma tu correo si es necesario e inicia sesi�n para solicitar vinculaci�n.');return;}
    await signIn(email,password);
   }
   await backendRequest('/barber-join/'+encodeURIComponent(code),{method:'POST',body:JSON.stringify({fullName:name})});
   setMessage('Solicitud enviada. El due�o debe aprobar tu incorporaci�n antes de que puedas acceder como barbero.');
  }catch(err){setMessage(err instanceof Error?err.message:'No se pudo enviar solicitud');}
  finally{setBusy(false);}
 };
 return <main className="min-h-screen bg-[#090909] text-white flex items-center justify-center p-5"><section className="bg-[#181818] border border-neutral-700 rounded-2xl p-8 w-full max-w-md space-y-4">
  <h1 className="text-2xl font-bold">Unirse al equipo de {target||'barber�a'}</h1>
  <p className="text-neutral-400 text-sm">El propietario debe aprobar tu solicitud.</p>
  <div className="flex gap-3"><button onClick={()=>setMode('login')} className="underline">Ya tengo cuenta</button><button onClick={()=>setMode('register')} className="underline">Crear cuenta</button></div>
  <form onSubmit={e=>void submit(e)} className="space-y-3">
   <input aria-label="Nombre completo" required minLength={2} value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre completo" className="w-full bg-neutral-900 rounded-lg p-3"/>
   {!hasSession()&&<><input aria-label="Correo" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Correo electr�nico" className="w-full bg-neutral-900 rounded-lg p-3"/>
   <input aria-label="Contrase�a" type="password" required minLength={mode==='register'?8:undefined} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Contrase�a" className="w-full bg-neutral-900 rounded-lg p-3"/></>}
   <button disabled={busy||!target} className="bg-amber-400 text-black font-semibold w-full p-3 rounded-lg">{busy?'Procesando...':mode==='register'?'Registrarme':'Solicitar vinculaci�n'}</button>
  </form>{message&&<p role="status" className="text-sm text-amber-300">{message}</p>}
 </section></main>;
}
