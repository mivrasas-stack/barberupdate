import React,{useEffect,useRef,useState} from 'react';
import {BrowserQRCodeReader, type IScannerControls} from '@zxing/browser';
import {useApp} from '../../context/AppContext';
import {Camera,CheckCircle2,ArrowRight,Store} from 'lucide-react';
import {linkCustomer,resolveBusinessLink,isLiveBackend} from '../../services/liveBackend';
import {useCustomerLinks} from '../../services/useCustomerLinks';

export const ClienteQRScanner:React.FC=()=>{
 const {currentUser,addToast,navigate}=useApp();
 const {items,profile}=useCustomerLinks(currentUser?.id);
 const [manualCode,setManualCode]=useState('');
 const [fullName,setFullName]=useState('');
 const [phone,setPhone]=useState('');
 const [scanning,setScanning]=useState(false);
 const [saving,setSaving]=useState(false);
 const [linkedResult,setLinkedResult]=useState<string|null>(null);
 const video=useRef<HTMLVideoElement>(null);
 const controls=useRef<IScannerControls|null>(null);
 const working=useRef(false);
 useEffect(()=>{if(profile){setFullName(profile.full_name);setPhone(profile.phone)}else if(currentUser?.name)setFullName(currentUser.name)},[profile,currentUser?.name]);
 useEffect(()=>()=>{controls.current?.stop();controls.current=null},[]);
 const parseCode=(value:string)=>{
   const raw=value.trim();
   try{
     const url=new URL(raw);
     if(url.pathname.startsWith('/vincular/'))return {
       code:decodeURIComponent(url.pathname.split('/')[2]||'').toUpperCase(),
       barberId:url.searchParams.get('barberId')||undefined
     };
   }catch{}
   return {code:raw.toUpperCase(),barberId:undefined};
 };
 const stop=()=>{controls.current?.stop();controls.current=null;setScanning(false)};
 const submit=async(value=manualCode)=>{
   const {code,barberId}=parseCode(value);
   if(!isLiveBackend){addToast('Para vincular se requiere el backend real','error');return}
   if(!fullName.trim()||!phone.trim()){addToast('Completa tu nombre y teléfono para vincularte','error');return}
   if(saving||!code)return;
   setSaving(true);
   try{
     await resolveBusinessLink(code,barberId);
     const linked=await linkCustomer(code,fullName.trim(),phone.trim(),barberId);
     setLinkedResult(linked.name);
     addToast('Vinculación guardada con '+linked.name,'success');
   }catch(e){addToast(e instanceof Error?e.message:'No se pudo vincular','error')}
   finally{setSaving(false)}
 };
 const camera=async()=>{
   if(scanning){stop();return}
   if(!navigator.mediaDevices?.getUserMedia){
     addToast('Activa HTTPS o usa localhost para escanear con cámara.','error');return
   }
   if(!video.current)return;
   setScanning(true);
   working.current=false;
   try{
     const decoder=new BrowserQRCodeReader();
     controls.current=await decoder.decodeFromVideoDevice(undefined,video.current,(result,_,ctrl)=>{
       if(result&&!working.current){
         working.current=true;
         const value=result.getText().trim();
         setManualCode(value);ctrl.stop();stop();
         void submit(value);
       }
     });
   }catch(e){
     stop();addToast(e instanceof Error?e.message:'No se pudo acceder a la cámara','error');
   }
 };
 return <div className="space-y-6 max-w-xl mx-auto">
   <div className="text-center pb-4 border-b border-[#242424]">
     <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">Conexión Directa</span>
     <h1 className="text-2xl font-extrabold text-white tracking-tight">Vincular Barbería o Barbero</h1>
     <p className="text-xs text-neutral-400 mt-1">Escanea el QR o ingresa el código real del negocio para asociarlo a tu cuenta.</p>
   </div>
   <div className="bg-[#141414] border border-[#262626] rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
     <div className="relative w-64 h-64 rounded-2xl bg-[#0a0a0a] border-2 border-dashed border-neutral-700 flex flex-col items-center justify-center overflow-hidden mb-4">
       <video ref={video} autoPlay muted playsInline className={'absolute inset-0 h-full w-full object-cover '+(scanning?'':'hidden')}/>
       {!scanning&&<div className="space-y-2 p-4"><Camera className="w-10 h-10 text-neutral-600 mx-auto"/><span className="text-xs text-neutral-400 block">Apunta con la cámara al código QR impreso</span></div>}
     </div>
     <button onClick={()=>void camera()} className="w-full py-3 rounded-xl bg-[var(--gold-primary)] text-black font-bold text-xs hover:bg-[var(--gold-hover)] transition-all flex items-center justify-center gap-2">
       <Camera className="w-4 h-4"/>{scanning?'Detener escáner':'Activar Escáner de Cámara'}
     </button>
   </div>
   <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 space-y-3 text-xs">
     <label htmlFor="link-name" className="text-neutral-300 font-semibold block">Nombre y apellidos</label>
     <input id="link-name" type="text" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Tu nombre completo" className="w-full bg-[#181818] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white"/>
     <label htmlFor="link-phone" className="text-neutral-300 font-semibold block">Teléfono de contacto</label>
     <input id="link-phone" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+57 300 123 4567" className="w-full bg-[#181818] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white"/>
     <label htmlFor="link-code" className="text-neutral-300 font-semibold block">O ingresa el código alfanumérico manualmente:</label>
     <div className="flex gap-2">
       <input id="link-code" type="text" value={manualCode} onChange={e=>setManualCode(e.target.value)} placeholder="Código que aparece bajo el QR" className="min-w-0 flex-1 bg-[#181818] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white font-mono uppercase"/>
       <button onClick={()=>void submit()} disabled={saving} className="px-5 py-2 rounded-xl bg-[#202020] hover:bg-[#282828] text-white font-bold disabled:opacity-50">Vincular</button>
     </div>
   </div>
   {linkedResult&&<div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
     <div className="flex items-center gap-2 text-emerald-400"><CheckCircle2 className="w-5 h-5"/><div><p className="font-bold text-white">Vinculado a {linkedResult}</p><p className="text-neutral-300">Ya puedes reservar con este negocio</p></div></div>
     <button onClick={()=>navigate('/clientes/citas/nueva')} className="px-3 py-2 bg-emerald-500 rounded-xl text-black flex items-center gap-1 font-bold">Reservar<ArrowRight className="w-3 h-3"/></button>
   </div>}
   <section className="bg-[#141414] border border-[#262626] rounded-2xl p-5 space-y-3">
     <h2 className="font-bold text-white text-sm">Mis barberías y profesionales vinculados</h2>
     {items.length===0?<p className="text-xs text-neutral-400">Todavía no tienes negocios vinculados. Escanea su QR para agregarlos.</p>:
       items.map(item=><div key={item.tenant_id} className="flex items-center justify-between gap-3 bg-[#1d1d1d] rounded-xl p-3 text-xs">
         <div className="flex items-center gap-2"><Store className="w-4 h-4 text-[var(--gold-primary)]"/><span className="text-white">{item.barber_name||item.name}</span></div>
         <button onClick={()=>navigate('/clientes/citas/nueva')} className="text-[var(--gold-primary)] font-bold">Reservar →</button>
       </div>)}
   </section>
 </div>;
};
