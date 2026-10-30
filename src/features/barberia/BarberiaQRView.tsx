import React,{useEffect,useState} from 'react';
import QRCode from 'qrcode';
import {useApp} from '../../context/AppContext';
import {QrCode,Copy,Printer} from 'lucide-react';
import {isLiveBackend,getBusinessLinkCode} from '../../services/liveBackend';

export const BarberiaQRView:React.FC=()=>{
 const {currentShop,state,addToast}=useApp();
 const activeBarbers=state.barbers.filter(b=>b.businessId===currentShop?.id&&b.status==='active');
 const [selectedBarberId,setSelectedBarberId]=useState('');
 useEffect(()=>{
   setSelectedBarberId(previous=>activeBarbers.some(b=>b.id===previous)?previous:activeBarbers[0]?.id||'');
 },[currentShop?.id,state.barbers]);
 const [link,setLink]=useState('');
 const [qrImage,setQrImage]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{
   if(!currentShop?.id)return;
   let alive=true;
   (async()=>{
     try{
       if(!isLiveBackend)throw Error('El QR requiere una barbería registrada en el backend real.');
       const data=await getBusinessLinkCode(currentShop.id);
       const url=window.location.origin+'/vincular/'+encodeURIComponent(data.link_code)
         +(selectedBarberId?'?barberId='+encodeURIComponent(selectedBarberId):'');
       const image=await QRCode.toDataURL(url,{width:360,margin:2,
         errorCorrectionLevel:'H',color:{dark:'#000000',light:'#ffffff'}});
       if(alive){setLink(url);setQrImage(image);setError('');}
     }catch(e){if(alive)setError(e instanceof Error?e.message:'No se pudo generar el QR');}
   })();
   return()=>{alive=false};
 },[currentShop?.id,selectedBarberId]);
 const copy=async()=>{
   if(!link)return;
   try{await navigator.clipboard.writeText(link);addToast('Enlace de vinculación copiado','success');}
   catch{addToast('No se pudo copiar el enlace; selecciónalo manualmente.','error');}
 };
 return <div className="space-y-6 max-w-2xl mx-auto">
   <div className="text-center pb-4 border-b border-[#242424]">
     <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">Fidelización Presencial</span>
     <h1 className="text-2xl font-extrabold text-white tracking-tight">Código QR de Vinculación</h1>
     <p className="text-xs text-neutral-400 mt-1">Coloca este QR en tus espejos y recepción para que los clientes se vinculen con un escaneo</p>
   </div>
   <div className="bg-[#141414] border border-[#262626] rounded-3xl p-8 text-center shadow-2xl flex flex-col items-center relative overflow-hidden">
     <div className="absolute top-0 w-72 h-32 bg-[var(--gold-primary)]/10 blur-[80px] rounded-full pointer-events-none"/>
     <div className="w-14 h-14 rounded-2xl bg-[var(--gold-primary)] text-black flex items-center justify-center mb-4"><QrCode className="w-8 h-8"/></div>
     <h2 className="text-xl font-bold text-white">{currentShop?.name||'Mi negocio'}</h2>
     <p className="text-xs text-neutral-400 mt-1 max-w-sm">Escanea para vincularte y reservar únicamente con el profesional seleccionado.</p>
     {activeBarbers.length>0&&<label className="mt-4 text-xs text-neutral-300 w-full text-left">QR exclusivo de
       <select value={selectedBarberId} onChange={e=>setSelectedBarberId(e.target.value)}
         className="block mt-2 w-full rounded-xl bg-[#202020] border border-[#444] p-3 text-white">
         {activeBarbers.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
       </select>
     </label>}
     {error&&<p role="alert" className="text-red-300 text-sm mt-4">{error}</p>}
     <div className="my-6 p-6 bg-white rounded-3xl shadow-2xl border-4 border-[var(--gold-primary)] inline-block">
       {qrImage?<img src={qrImage} alt={'QR real de '+(currentShop?.name||'mi negocio')} className="w-52 h-52" data-testid="real-business-qr"/>:
         <div className="w-52 h-52 flex items-center justify-center text-neutral-500 text-xs">Preparando QR seguro...</div>}
       <span className="block mt-2 font-mono font-bold text-[10px] text-black tracking-wide">{link.split('/').pop()||'—'}</span>
     </div>
     <div className="w-full bg-[#181818] border border-[#262626] rounded-xl p-3 flex items-center justify-between text-xs text-neutral-300">
       <span className="truncate font-mono text-[11px] text-neutral-400" title={link}>{link||'Generando enlace...'}</span>
       <button onClick={()=>void copy()} disabled={!link} className="p-1.5 rounded-lg bg-[#242424] hover:bg-[var(--gold-primary)] hover:text-black disabled:opacity-40" title="Copiar enlace"><Copy className="w-3.5 h-3.5"/></button>
     </div>
     <div className="mt-6 flex flex-wrap items-center justify-center gap-3 w-full">
       <button onClick={()=>window.print()} disabled={!qrImage} className="flex-1 py-3 rounded-xl bg-[#202020] hover:bg-[#2a2a2a] text-white font-semibold text-xs flex items-center justify-center gap-2 border border-neutral-700 disabled:opacity-40"><Printer className="w-4 h-4 text-[var(--gold-primary)]"/>Imprimir QR para Espejo</button>
       <button onClick={()=>void copy()} disabled={!link} className="flex-1 py-3 rounded-xl bg-[var(--gold-primary)] hover:bg-[var(--gold-hover)] text-black font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-40"><Copy className="w-4 h-4"/>Copiar Enlace Directo</button>
     </div>
     <p className="text-[11px] text-neutral-500 mt-4">Para escanear desde otro teléfono necesitas que esta web esté publicada con HTTPS y una dirección accesible para ese teléfono.</p>
   </div>
 </div>;
};
