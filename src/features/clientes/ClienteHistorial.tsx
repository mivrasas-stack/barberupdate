import React,{useState} from 'react';
import {useApp} from '../../context/AppContext';
import {barberStore} from '../../services/store';
import {formatCurrency} from '../../utils/formatters';
import {isLiveBackend,publishReview,refreshLiveData} from '../../services/liveBackend';
import {History,Star,MessageSquare,Check,X,ChevronDown} from 'lucide-react';
import type {Appointment} from '../../types';

export const ClienteHistorial:React.FC=()=>{
 const {state,currentUser,currency,addToast}=useApp();
 const customerId=currentUser?.id||'usr-client-1';
 const appointments=state.appointments.filter(a=>a.customerId===customerId)
  .sort((a,b)=>(b.date+b.startTime).localeCompare(a.date+a.startTime));
 const [expandedId,setExpandedId]=useState<string|null>(null);
 const [rating,setRating]=useState(5);
 const [comment,setComment]=useState('');
 const [busy,setBusy]=useState(false);
 const sendReview=async(e:React.FormEvent,appt:Appointment)=>{
  e.preventDefault();
  if(busy||!comment.trim()||!appt.businessId||appt.status!=='completed')return;
  if(state.reviews.some(r=>r.appointmentId===appt.id)){addToast('Esta cita ya tiene una reseña','info');return;}
  setBusy(true);
  try{
   if(isLiveBackend){
    await publishReview(appt.businessId,appt.id,rating,comment.trim());
    await refreshLiveData();
   }else{
    barberStore.addReview({businessId:appt.businessId,barberId:appt.barberId,customerId,
     customerName:currentUser?.name||'Cliente',customerAvatar:currentUser?.avatar||'',
     appointmentId:appt.id,rating,comment:comment.trim()});
    barberStore.awardLoyaltyPoints(customerId,25,'Bono por primera reseña');
   }
   addToast('Reseña publicada. Gracias por compartir tu experiencia.','success');
   setComment('');setExpandedId(null);setRating(5);
  }catch(err){addToast(err instanceof Error?err.message:'No se pudo publicar la reseña','error');}
  finally{setBusy(false);}
 };
 return (
 <div className="space-y-6 max-w-4xl mx-auto">
  <div className="border-b border-[#242424] pb-4">
   <span className="text-xs uppercase tracking-wider font-semibold text-[var(--gold-primary)]">Registro Personal</span>
   <h1 className="text-2xl font-extrabold text-white">Historial de Cortes & Reseñas</h1>
   <p className="text-xs text-neutral-400 mt-1">Consulta el detalle de cada cita y reseña los servicios completados.</p>
  </div>
  {appointments.length===0 && <div className="p-6 rounded-2xl border border-neutral-800 text-xs text-neutral-400">Todavía no tienes citas registradas.</div>}
  {appointments.map(apt=>{
   const barber=state.barbers.find(b=>b.id===apt.barberId);
   const shop=state.barbershops.find(s=>s.id===apt.businessId);
   const review=state.reviews.find(r=>r.appointmentId===apt.id&&r.customerId===customerId);
   const open=expandedId===apt.id;
   return <div key={apt.id} className="rounded-2xl bg-[#141414] border border-[#262626] p-4 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-4">
     <div>
      <h2 className="text-sm font-bold text-white">{apt.serviceName||'Servicio'} · {shop?.name||'Barbería'}</h2>
      <p className="text-neutral-400 mt-1">{apt.date} a las {apt.startTime} · Barbero: {barber?.name||'Por confirmar'}</p>
      <p className="text-neutral-500 mt-1">Estado: {apt.status}</p>
     </div>
     <div className="flex items-center gap-3">
      <span className="text-white font-mono font-bold">{formatCurrency(apt.finalPrice,currency)}</span>
      <button aria-expanded={open} onClick={()=>{setExpandedId(open?null:apt.id);setRating(5);setComment('');}}
       className="px-3.5 py-2 rounded-xl bg-[var(--gold-primary)] text-black font-bold flex items-center gap-1">
       {open?'Ocultar':'Ver detalle'} <ChevronDown className="w-4 h-4"/>
      </button>
     </div>
    </div>
    {open&&<section className="mt-4 border-t border-neutral-800 pt-4 space-y-3">
     <h3 className="font-bold text-white">Detalle de la cita</h3>
     <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-300">
      <div><dt className="text-neutral-500">Servicio</dt><dd>{apt.serviceName}</dd></div>
      <div><dt className="text-neutral-500">Barbero</dt><dd>{barber?.name||'No disponible'}</dd></div>
      <div><dt className="text-neutral-500">Fecha y hora</dt><dd>{apt.date} · {apt.startTime}</dd></div>
      <div><dt className="text-neutral-500">Duración</dt><dd>{apt.durationMinutes} minutos</dd></div>
      <div><dt className="text-neutral-500">Total</dt><dd>{formatCurrency(apt.finalPrice,currency)}</dd></div>
      <div><dt className="text-neutral-500">Estado</dt><dd>{apt.status}</dd></div>
     </dl>
     {review?<div className="rounded-xl border border-amber-600/30 p-4">
      <p className="font-bold text-amber-400">Tu calificación: {'★'.repeat(review.rating)}</p>
      <p className="mt-2 text-neutral-200">{review.comment}</p>
     </div>:apt.status==='completed'?<form onSubmit={e=>void sendReview(e,apt)} className="border-t border-neutral-800 pt-4 space-y-3">
      <h3 className="font-bold text-white">Dejar una reseña de este corte</h3>
      <div className="flex items-center gap-1" role="group" aria-label="Calificación del servicio">
       {[1,2,3,4,5].map(star=><button type="button" key={star} aria-label={star+' estrellas'} aria-pressed={rating===star} onClick={()=>setRating(star)}
        className={'text-2xl '+(star<=rating?'text-amber-400':'text-neutral-600')}>★</button>)}
      </div>
      <label className="block text-neutral-300">Tu opinión
       <textarea required maxLength={2000} minLength={2} rows={3} value={comment} onChange={e=>setComment(e.target.value)}
        placeholder="Cuéntanos cómo fue tu experiencia..." className="mt-1 w-full bg-[#181818] border border-neutral-700 rounded-lg p-3 text-white"/>
      </label>
      <p className="text-neutral-400">Solo se admite una reseña por cita completada. Se otorgan 25 puntos la primera vez.</p>
      <button disabled={busy} type="submit" className="px-4 py-2 rounded-xl bg-[var(--gold-primary)] font-bold text-black disabled:opacity-40">
       {busy?'Publicando...':'Publicar reseña'}
      </button>
     </form>:<p className="text-neutral-400">Podrás reseñar este servicio cuando la cita figure como completada.</p>}
    </section>}
   </div>;
  })}
 </div>
 );
};