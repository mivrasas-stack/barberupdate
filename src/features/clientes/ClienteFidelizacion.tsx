import React, {useState} from 'react';
import {useApp} from '../../context/AppContext';
import {isLiveBackend, redeemReward, refreshLiveData} from '../../services/liveBackend';
import {Award, Sparkles, Gift, Flame, CheckCircle2} from 'lucide-react';
import type {LoyaltyReward} from '../../types';

export const ClienteFidelizacion:React.FC=()=>{
 const {state,currentUser,addToast}=useApp();
 const customerId=currentUser?.id||'usr-client-1';
 const loyalty=state.loyalty[customerId]||(!isLiveBackend?state.loyalty['usr-client-1']:undefined);
 const points=isLiveBackend?(loyalty?.points??0):(loyalty?.points??0);
 const visits=loyalty?.visitsCount??0;
 const [redeeming,setRedeeming]=useState('');
 const rewards=isLiveBackend?state.rewards.filter(r=>r.isActive):[];
 const getTenant=(id:string)=>state.barbershops.find(s=>s.id===id)?.name||'Barbería';
 const tenantBalance=(reward:LoyaltyReward)=>state.loyaltyBalances[reward.tenantId]?.points??0;
 const onRedeem=async(reward:LoyaltyReward)=>{
  if(!isLiveBackend || redeeming)return;
  if(tenantBalance(reward)<reward.pointsCost){addToast('No tienes suficientes puntos en esta barbería','error');return;}
  if(!window.confirm('¿Canjear '+reward.pointsCost+' puntos en '+getTenant(reward.tenantId)+' por '+reward.title+'?'))return;
  setRedeeming(reward.id);
  try{
   await redeemReward(reward.tenantId,reward.id);
   await refreshLiveData();
   addToast('Canje registrado; solicita la entrega a la barbería.','success');
  }catch(err){addToast(err instanceof Error?err.message:'No se pudo canjear','error');}
  finally{setRedeeming('');}
 };
 return (
  <div className="space-y-6 max-w-4xl mx-auto">
   <div className="border-b border-[#242424] pb-4">
    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">Club de Beneficios</span>
    <h1 className="text-2xl font-extrabold text-white">Puntos & Fidelidad</h1>
    <p className="mt-1 text-xs text-neutral-400">Tu saldo real se acumula por barbería. Solo puedes canjear recompensas con los puntos de esa misma sede.</p>
   </div>
   {!isLiveBackend && <p className="rounded-xl border border-amber-700/40 p-3 text-xs text-amber-300">Modo demostración: los puntos de ejemplo no son saldo real ni se pueden canjear.</p>}
   <div className="p-6 rounded-3xl bg-gradient-to-r from-[#181818] via-[#141414] to-[#1c1c1c] border border-[var(--gold-primary)]/40 flex flex-col sm:flex-row sm:justify-between gap-5">
    <div>
     <p className="text-xs font-bold text-[var(--gold-primary)] uppercase flex items-center gap-2"><Sparkles className="w-4 h-4"/>Saldo acumulado</p>
     <p className="text-4xl font-black text-white font-mono mt-2">{points} <span className="text-sm text-neutral-400 font-normal">puntos</span></p>
     <p className="mt-2 text-xs text-neutral-400">{visits} visitas registradas</p>
    </div>
    <div className="p-4 bg-black/60 rounded-2xl border border-neutral-800 text-xs text-neutral-300 max-w-sm">
     <p className="font-bold text-[var(--gold-primary)] mb-2">Reglas verificadas</p>
     <p>Servicios habilitados por la barbería: 1 punto por cada $1.000 COP de la cita completada.</p>
     <p className="mt-1">+25 puntos por la primera reseña de una cita completada.</p>
    </div>
   </div>
   {isLiveBackend && (
    <div className="rounded-2xl bg-[#141414] border border-[#262626] p-5">
     <h2 className="text-sm font-bold text-white mb-3">Saldo por barbería</h2>
     {Object.keys(state.loyaltyBalances).length===0?<p className="text-xs text-neutral-400">Aún no tienes puntos acumulados.</p>:
      Object.values(state.loyaltyBalances).map(b=><div key={b.tenantId} className="flex justify-between gap-4 py-2 border-b border-neutral-800 text-xs">
       <span>{getTenant(b.tenantId)}</span><strong className="text-[var(--gold-primary)]">{b.points} puntos · {b.visitsCount} visitas</strong>
      </div>)}
    </div>
   )}
   <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-4">
    <h2 className="text-sm font-bold text-white flex gap-2"><Gift className="w-4 h-4 text-[var(--gold-primary)]"/>Recompensas disponibles para canjear</h2>
    {rewards.length===0?<p className="text-xs text-neutral-400">Aún no hay recompensas publicadas por las barberías.</p>:
     rewards.map(r=><div key={r.id} className="p-4 bg-[#181818] rounded-xl border border-neutral-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
      <div>
       <h3 className="text-white font-bold">{r.title}</h3>
       <p className="text-neutral-400 mt-1">{getTenant(r.tenantId)}{r.description?' · '+r.description:''}</p>
       <p className="text-[var(--gold-primary)] font-bold mt-1">{r.pointsCost} puntos requeridos · tu saldo aquí: {tenantBalance(r)}</p>
      </div>
      <button disabled={!!redeeming||tenantBalance(r)<r.pointsCost} onClick={()=>void onRedeem(r)}
        className="rounded-xl px-4 py-2 bg-[var(--gold-primary)] text-black font-bold disabled:opacity-30">
       {redeeming===r.id?'Procesando...':'Canjear'}
      </button>
     </div>)}
   </div>
   {isLiveBackend && (
    <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-3">
     <h2 className="text-sm font-bold text-white">Mis canjes</h2>
     {state.redemptions.length===0?<p className="text-xs text-neutral-400">No has realizado canjes todavía.</p>:state.redemptions.map(r=>
      <div key={r.id} className="flex justify-between gap-4 border-b border-neutral-800 py-2 text-xs">
       <span>{r.title||'Recompensa'} · {getTenant(r.tenantId)}</span>
       <span className="text-[var(--gold-primary)]">{r.status==='fulfilled'?'Entregado':'Pendiente de entrega'} · -{r.pointsCost} pts</span>
      </div>)}
    </div>
   )}
   <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-3">
    <h2 className="text-sm font-bold text-white flex gap-2"><Award className="w-4 h-4 text-[var(--gold-primary)]"/>Movimientos de puntos</h2>
    {!loyalty?.pointHistory.length?<p className="text-xs text-neutral-400">No hay movimientos registrados.</p>:
     loyalty.pointHistory.map(ev=><div key={ev.id} className="flex justify-between py-2 border-b border-neutral-800 text-xs">
      <span className="text-neutral-300">{ev.concept} · {ev.date}</span><span className={ev.points>=0?'text-emerald-400':'text-red-300'}>{ev.points>0?'+':''}{ev.points}</span>
     </div>)}
   </div>
  </div>
 );
};