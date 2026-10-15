import React from 'react';
import {useApp} from '../../context/AppContext';
import {Star,MessageSquare,UserCheck} from 'lucide-react';
import {isLiveBackend} from '../../services/liveBackend';

export const BarberiaResenas:React.FC=()=>{
 const {currentShop,state}=useApp();
 const shopId=currentShop?.id||'shop-1';
 const reviews=state.reviews.filter(r=>r.businessId===shopId);
 const avg=reviews.length?(reviews.reduce((sum,r)=>sum+r.rating,0)/reviews.length).toFixed(1):'—';
 const barbers=state.barbers.filter(b=>b.businessId===shopId);
 return <div className="space-y-6">
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
   <div>
    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">Reputación & Experiencia</span>
    <h1 className="text-2xl font-extrabold text-white">Reseñas & Calificaciones</h1>
    <p className="mt-1 text-xs text-neutral-400">Opiniones verificadas de clientes que finalizaron un servicio en tu barbería.</p>
   </div>
   <div className="flex items-center gap-2 rounded-xl p-3 bg-[#141414] border border-[#262626]">
    <Star className="w-5 h-5 text-amber-400 fill-amber-400"/>
    <strong className="text-xl font-mono text-white">{avg}</strong>
    <span className="text-xs text-neutral-400">/ 5 · {reviews.length} reseñas</span>
   </div>
  </div>
  <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5">
   <h2 className="text-sm font-bold text-white mb-4">Calificación por barbero</h2>
   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {barbers.map(b=>{
     const entries=reviews.filter(r=>r.barberId===b.id);
     const rating=entries.length?(entries.reduce((a,r)=>a+r.rating,0)/entries.length).toFixed(1):'Sin calificación';
     return <div key={b.id} className="rounded-xl bg-[#181818] border border-[#292929] p-4 flex items-center justify-between gap-3 text-xs">
      <span className="text-white font-bold">{b.name}</span>
      <span className="text-amber-400">{rating} {entries.length?'★':''} · {entries.length} reseñas</span>
     </div>;
    })}
    {barbers.length===0&&<p className="text-xs text-neutral-400">No hay barberos registrados.</p>}
   </div>
  </div>
  <div className="space-y-3">
   {reviews.length===0?<div className="bg-[#141414] border border-[#262626] p-6 rounded-2xl text-xs text-neutral-400">
    Todavía no hay reseñas verificadas de clientes.</div>:reviews.map(rev=>{
    const barber=barbers.find(b=>b.id===rev.barberId);
    const appointment=state.appointments.find(a=>a.id===rev.appointmentId);
    return <article key={rev.id} className="rounded-2xl border border-[#262626] bg-[#141414] p-5 space-y-2 text-xs">
     <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
       <h3 className="font-bold text-white">{rev.customerName||'Cliente'}</h3>
       <p className="text-[11px] text-neutral-400">{rev.date} · {barber?.name||'Barbero'}{appointment?.serviceName?' · '+appointment.serviceName:''}</p>
      </div>
      <span className="font-bold text-amber-400">{'★'.repeat(rev.rating)} <span className="text-neutral-500">{rev.rating}/5</span></span>
     </div>
     <p className="text-neutral-200 whitespace-pre-wrap">{rev.comment||'Sin comentario adicional'}</p>
    </article>;
   })}
  </div>
 </div>;
};