import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Service, ServiceCategory } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { CopAmountInput } from '../../components/common/CopAmountInput';
import { Scissors, Plus, Clock, Users, X, Edit2, CheckCircle2 } from 'lucide-react';
import {isLiveBackend, addService, editService, refreshLiveData} from '../../services/liveBackend';

export const BarberiaServicios: React.FC = () => {
  const { currentShop, state, currency, addToast } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState<number|null>(null);
  const [formDuration, setFormDuration] = useState(0);
  const [formCategory, setFormCategory] = useState<ServiceCategory>('haircut');

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
    setIsModalOpen(true);
  };

  const handleOpenEdit = (srv: Service) => {
    setEditingService(srv);
    setFormName(srv.name);
    setFormDesc(srv.description);
    setFormPrice(srv.price);
    setFormDuration(srv.durationMinutes);
    setFormCategory(srv.category);
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
          durationMinutes:formDuration,category:formCategory};
        if(editingService)await editService(shopId,editingService.id,payload);
        else await addService(shopId,payload);
        await refreshLiveData();
        addToast('Servicio guardado en BarberOS', 'success');
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
        barberIds: barbers.map(b => b.id),
        isActive: true,
        order: services.length + 1,
      };
      state.services.push(newSrv);
      addToast(`Servicio ${formName} creado`, 'success');
    }
    setIsModalOpen(false);
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

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black text-xs font-bold hover:bg-[var(--gold-hover)] transition-all shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Servicio</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
