import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Service, ServiceCategory, LoyaltyReward } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { CopAmountInput } from '../../components/common/CopAmountInput';
import { Scissors, Plus, Clock, Users, X, Edit2, CheckCircle2, Gift } from 'lucide-react';
import {isLiveBackend, addService, editService, createReward, editReward, fulfillRedemption, refreshLiveData} from '../../services/liveBackend';

export const BarberiaServicios: React.FC = () => {
  const { currentShop, currentUser, state, currency, addToast } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState<number|null>(null);
  const [formDuration, setFormDuration] = useState(0);
  const [formCategory, setFormCategory] = useState<ServiceCategory>('haircut');
  const [formEarnsPoints,setFormEarnsPoints]=useState(false);
  const [tab,setTab]=useState<'services'|'rewards'>('services');
  const [editingReward,setEditingReward]=useState<LoyaltyReward|null>(null);
  const [rewardTitle,setRewardTitle]=useState('');
  const [rewardDescription,setRewardDescription]=useState('');
  const [rewardCost,setRewardCost]=useState(100);
  const [rewardBusy,setRewardBusy]=useState(false);

  const shopId = currentShop?.id || 'shop-1';
  const services = state.services.filter(s => s.businessId === shopId);
  const barbers = state.barbers.filter(b => b.businessId === shopId);

  const handleOpenCreate = () => {
    setEditingService(null);
    setFormName('');
    setFormDesc('');
    setFormPrice(null);
    setFormDuration(0);
    setFormCategory('haircut');
    setFormEarnsPoints(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (srv: Service) => {
    setEditingService(srv);
    setFormName(srv.name);
    setFormDesc(srv.description);
    setFormPrice(srv.price);
    setFormDuration(srv.durationMinutes);
    setFormCategory(srv.category);
    setFormEarnsPoints(srv.earnsLoyaltyPoints===true);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if(formPrice===null||formPrice<0||!Number.isSafeInteger(formPrice)||formDuration<5||formDuration>600||formDuration%5!==0){
      addToast('Ingresa un precio en COP y una duración válida (mínimo 5 minutos)','error');return;
    }
    if(isLiveBackend){
      try{
        const payload={name:formName,description:formDesc,price:formPrice,
          durationMinutes:formDuration,category:formCategory,earnsLoyaltyPoints:formEarnsPoints};
        if(editingService)await editService(shopId,editingService.id,payload);
        else await addService(shopId,payload);
        await refreshLiveData();
        addToast('Servicio guardado en BarberNow', 'success');
        setIsModalOpen(false);
      }catch(error){addToast(error instanceof Error?error.message:'Error al guardar servicio','error');}
      return;
    }
    if (editingService) {
      editingService.name = formName;
      editingService.description = formDesc;
      editingService.price = formPrice;
      editingService.durationMinutes = formDuration;
      editingService.category = formCategory;
      editingService.earnsLoyaltyPoints=formEarnsPoints;
      addToast(`Servicio ${formName} actualizado`, 'success');
    } else {
      const newSrv: Service = {
        id: `srv-${Date.now()}`,
        businessId: shopId,
        name: formName,
        description: formDesc,
        price: formPrice,
        durationMinutes: formDuration,
        category: formCategory,
        earnsLoyaltyPoints:formEarnsPoints,
        barberIds: barbers.map(b => b.id),
        isActive: true,
        order: services.length + 1,
      };
      state.services.push(newSrv);
      addToast(`Servicio ${formName} creado`, 'success');
    }
    setIsModalOpen(false);
  };


  const rewards=state.rewards.filter(r=>r.tenantId===shopId);
  const redemptions=state.redemptions.filter(r=>r.tenantId===shopId);
  const saveReward=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!isLiveBackend){addToast('Las recompensas requieren una conexión real con Supabase.','info');return;}
    if(!rewardTitle.trim()||!Number.isInteger(rewardCost)||rewardCost<1){addToast('Completa nombre y puntos válidos.','error');return;}
    setRewardBusy(true);
    try{
      const body={title:rewardTitle.trim(),description:rewardDescription.trim(),pointsCost:rewardCost,isActive:editingReward?.isActive??true};
      if(editingReward)await editReward(shopId,editingReward.id,body);
      else await createReward(shopId,body);
      await refreshLiveData();
      setEditingReward(null);setRewardTitle('');setRewardDescription('');setRewardCost(100);
      addToast('Recompensa guardada correctamente','success');
    }catch(error){addToast(error instanceof Error?error.message:'No se pudo guardar la recompensa','error');}
    finally{setRewardBusy(false);}
  };
  const toggleReward=async(reward:LoyaltyReward)=>{
    if(!isLiveBackend)return;
    setRewardBusy(true);
    try{
      await editReward(shopId,reward.id,{isActive:!reward.isActive});
      await refreshLiveData();
      addToast('Disponibilidad de recompensa actualizada','success');
    }catch(error){addToast(error instanceof Error?error.message:'No se pudo cambiar la recompensa','error');}
    finally{setRewardBusy(false);}
  };
  const markFulfilled=async(id:string)=>{
    if(!isLiveBackend || !window.confirm('¿Confirmar que la recompensa ya fue entregada?'))return;
    setRewardBusy(true);
    try{await fulfillRedemption(shopId,id);await refreshLiveData();addToast('Entrega confirmada','success');}
    catch(error){addToast(error instanceof Error?error.message:'Error al confirmar entrega','error');}
    finally{setRewardBusy(false);}
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Menú de Atención
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Servicios & Tarifas</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Configura los servicios ofrecidos, tiempos de atención y precios vigentes en agenda
          </p>
        </div>

        {tab==='services' && <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black text-xs font-bold hover:bg-[var(--gold-hover)] transition-all shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Servicio</span>
        </button>}
      </div>

      <div role="tablist" aria-label="Servicios y recompensas" className="flex flex-wrap gap-2 border-b border-[#242424] pb-3">
        <button role="tab" aria-selected={tab==='services'} onClick={()=>setTab('services')}
          className={`px-4 py-2 rounded-xl text-xs font-bold ${tab==='services'?'bg-[var(--gold-primary)] text-black':'bg-[#202020] text-neutral-300'}`}>Servicios & Tarifas</button>
        {currentUser?.role==='owner' && <button role="tab" aria-selected={tab==='rewards'} onClick={()=>setTab('rewards')}
          className={`px-4 py-2 rounded-xl text-xs font-bold ${tab==='rewards'?'bg-[var(--gold-primary)] text-black':'bg-[#202020] text-neutral-300'}`}>
          Recompensas y canjes</button>}
      </div>

      <div className={tab==='services'?'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4':'hidden'}>
        {services.map(srv => (
          <div
            key={srv.id}
            className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl flex flex-col justify-between hover:border-neutral-700 transition-colors"
          >
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#202020] text-[var(--gold-primary)] border border-neutral-800 uppercase">
                  {srv.category}
                </span>
                <span className="flex items-center gap-1 text-neutral-400 text-[11px] font-mono">
                  <Clock className="w-3.5 h-3.5 text-neutral-500" />
                  {srv.durationMinutes} min
                </span>
              </div>

              <h3 className="text-sm font-bold text-white mt-1">{srv.name}</h3>
              <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{srv.description}</p>
              <p className={`mt-2 text-[11px] ${srv.earnsLoyaltyPoints?'text-emerald-400':'text-neutral-500'}`}>
                {srv.earnsLoyaltyPoints?'✓ Acumula puntos de fidelidad':'Sin puntos de fidelidad'}
              </p>

              <div className="mt-4 pt-3 border-t border-neutral-800">
                <div className="text-xl font-mono font-bold text-white">
                  {formatCurrency(srv.price, currency)}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Habilitado para reservas
              </span>
              <button
                onClick={() => handleOpenEdit(srv)}
                className="p-2 rounded-lg bg-[#202020] hover:bg-[var(--gold-primary)] hover:text-black text-neutral-300 transition-colors"
                title="Editar servicio"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {tab==='rewards' && <div className="space-y-5">
        {!isLiveBackend && <p className="text-xs text-amber-300 border border-amber-600/30 rounded-xl p-3">La administración real de recompensas está disponible con backend conectado.</p>}
        <form onSubmit={e=>void saveReward(e)} className="bg-[#141414] border border-[#262626] rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-white">{editingReward?'Editar recompensa':'Nueva recompensa para tus clientes'}</h2>
          <label className="block text-xs text-neutral-300">Nombre de recompensa
            <input required minLength={3} maxLength={120} value={rewardTitle} onChange={e=>setRewardTitle(e.target.value)}
              placeholder="Ej. Corte de cortesía" className="mt-1 w-full bg-[#181818] border border-[#303030] rounded-lg px-3 py-2 text-white"/>
          </label>
          <label className="block text-xs text-neutral-300">Descripción
            <textarea rows={2} maxLength={500} value={rewardDescription} onChange={e=>setRewardDescription(e.target.value)}
              className="mt-1 w-full bg-[#181818] border border-[#303030] rounded-lg px-3 py-2 text-white"/>
          </label>
          <label className="block text-xs text-neutral-300">Puntos requeridos
            <input required type="number" min={1} max={1000000} step={1} value={rewardCost} onChange={e=>setRewardCost(Number(e.target.value))}
              className="mt-1 w-full bg-[#181818] border border-[#303030] rounded-lg px-3 py-2 text-white"/>
          </label>
          <div className="flex gap-3">
            <button disabled={rewardBusy||!isLiveBackend} type="submit" className="px-4 py-2 rounded-xl bg-[var(--gold-primary)] text-black font-bold text-xs disabled:opacity-40">
              {rewardBusy?'Guardando...':editingReward?'Guardar cambios':'Crear recompensa'}
            </button>
            {editingReward && <button type="button" onClick={()=>{setEditingReward(null);setRewardTitle('');setRewardDescription('');setRewardCost(100);}} className="text-xs text-neutral-400">Cancelar edición</button>}
          </div>
        </form>
        <section className="bg-[#141414] border border-[#262626] rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white mb-3">Recompensas de la barbería</h2>
          {rewards.length===0?<p className="text-xs text-neutral-400">Aún no has creado recompensas.</p>:rewards.map(r=>
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 py-3 text-xs">
              <div><p className="text-white font-bold">{r.title}</p><p className="text-neutral-400">{r.pointsCost} puntos · {r.isActive?'Disponible':'Pausada'}</p></div>
              <div className="flex gap-2">
                <button onClick={()=>{setEditingReward(r);setRewardTitle(r.title);setRewardDescription(r.description);setRewardCost(r.pointsCost);}}
                  className="text-[var(--gold-primary)] px-2 py-1">Editar</button>
                <button disabled={rewardBusy||!isLiveBackend} onClick={()=>void toggleReward(r)}
                  className="text-neutral-300 px-2 py-1 disabled:opacity-40">{r.isActive?'Pausar':'Publicar'}</button>
              </div>
            </div>)}
        </section>
        <section className="bg-[#141414] border border-[#262626] rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white mb-3">Canjes pendientes de entrega</h2>
          {redemptions.length===0?<p className="text-xs text-neutral-400">No hay canjes registrados.</p>:redemptions.map(r=>
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 py-3 text-xs">
              <div><p className="font-bold text-white">{r.title}</p><p className="text-neutral-400">{r.pointsCost} puntos · {r.status==='fulfilled'?'Entregado':'Pendiente'} · Cliente: {r.userId?.slice(0,8)||'registrado'}</p></div>
              {r.status==='pending'&&<button disabled={rewardBusy} onClick={()=>void markFulfilled(r.id)} className="px-3 py-2 rounded-xl bg-[var(--gold-primary)] text-black font-bold disabled:opacity-50">
                Marcar entregado
              </button>}
            </div>)}
        </section>
      </div>}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <h3 className="text-base font-bold text-white">
                {editingService ? 'Editar Servicio' : 'Nuevo Servicio de Barbería'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="py-4 space-y-3 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Nombre del Servicio</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Ej. Corte Clásico & Afeitado Navaja"
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder="Incluye lavado, toalla tibia..."
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Precio (COP)</label>
                  <CopAmountInput required ariaLabel="Precio del servicio en COP" value={formPrice} onChange={setFormPrice}
                    className="bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono" />
                </div>

                <div>
                  <label className="text-neutral-400 block mb-1">Duración (Minutos)</label>
                  <input
                    type="number"
                    required
                    step={5}
                    min={5}
                    placeholder="0"
                    value={formDuration || ''}
                    onChange={e => setFormDuration(Number(e.target.value))}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Categoría</label>
                <select
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value as ServiceCategory)}
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                >
                  <option value="haircut">Corte de Cabello</option>
                  <option value="beard">Barba & Afeitado</option>
                  <option value="combo">Combo Completo</option>
                  <option value="eyebrows">Cejas & Diseño</option>
                  <option value="treatments">Tratamientos Capilares</option>
                  <option value="special">Servicio Especial</option>
                </select>
              </div>

              <label className="flex items-start gap-2.5 text-xs text-neutral-300 border border-[#303030] rounded-xl p-3">
                <input type="checkbox" checked={formEarnsPoints} onChange={e=>setFormEarnsPoints(e.target.checked)} className="mt-0.5 accent-amber-400"/>
                <span><strong>Este servicio acumula puntos de fidelidad</strong>
                  <small className="block mt-1 text-neutral-400">Al completarse la cita, se abona 1 punto por cada $1.000 COP del servicio.</small>
                </span>
              </label>

              <div className="pt-3 border-t border-[#262626] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[var(--gold-primary)] text-black font-bold hover:bg-[var(--gold-hover)]"
                >
                  Guardar Servicio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
