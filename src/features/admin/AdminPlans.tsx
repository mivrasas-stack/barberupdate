import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SubscriptionPlan } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { barberStore } from '../../services/store';
import { Layers, Plus, Check, Edit2, Copy, ToggleLeft, ToggleRight, X, Sparkles } from 'lucide-react';

export const AdminPlans: React.FC = () => {
  const { state, currency, addToast } = useApp();
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [form, setForm] = useState<Partial<SubscriptionPlan>>({});

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setForm(plan);
  };

  const handleCreateNew = () => {
    const blank: SubscriptionPlan = {
      id: '',
      name: 'Nuevo Plan Comercial',
      audience: 'barbershop',
      tagline: 'Descripción del plan para atraer nuevos clientes',
      monthlyPrice: 99000,
      annualPrice: 990000,
      currency: 'COP',
      maxBarbers: 5,
      maxPortfolioImages: 10,
      features: ['Gestión de citas', 'Control de caja básica', 'Código QR propio'],
      isActive: true,
      order: state.plans.length + 1,
    };
    setEditingPlan(blank);
    setForm(blank);
  };

  const handleSave = () => {
    if (!form.name) return;
    if (editingPlan?.id) {
      barberStore.updatePlan(form as SubscriptionPlan);
      addToast('Plan comercial actualizado correctamente', 'success');
    } else {
      barberStore.createPlan(form as Omit<SubscriptionPlan, 'id'>);
      addToast('Nuevo plan comercial creado con éxito', 'success');
    }
    setEditingPlan(null);
  };

  const handleDuplicate = (plan: SubscriptionPlan) => {
    barberStore.createPlan({
      ...plan,
      name: `${plan.name} (Copia)`,
    });
    addToast(`Plan duplicado: ${plan.name} (Copia)`, 'info');
  };

  const handleToggleActive = (plan: SubscriptionPlan) => {
    barberStore.updatePlan({
      ...plan,
      isActive: !plan.isActive,
    });
    addToast(`Estado de plan actualizado: ${!plan.isActive ? 'Activo' : 'Pausado'}`, 'info');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Estrategia de Monetización
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Planes Comerciales</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Configura tarifas, capacidades de sillas y características para barberos y franquicias
          </p>
        </div>

        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black text-xs font-bold hover:bg-[var(--gold-hover)] transition-all shadow-lg shadow-[var(--gold-primary)]/10"
        >
          <Plus className="w-4 h-4" />
          <span>Crear Nuevo Plan</span>
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {state.plans.map(plan => (
          <div
            key={plan.id}
            className={`bg-[#141414] border rounded-2xl p-5 flex flex-col justify-between transition-all relative ${
              plan.isPopular ? 'border-[var(--gold-primary)] shadow-xl shadow-[var(--gold-primary)]/5' : 'border-[#262626]'
            }`}
          >
            {plan.isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[var(--gold-primary)] text-black font-extrabold text-[10px] uppercase tracking-wider shadow-md">
                Destacado Web
              </div>
            )}

            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#202020] text-neutral-300 border border-neutral-700">
                  {plan.audience === 'barbershop' ? 'Barberías' : 'Independiente'}
                </span>
                <span className={`text-[11px] font-medium ${plan.isActive ? 'text-emerald-400' : 'text-neutral-500'}`}>
                  {plan.isActive ? 'Activo' : 'Desactivado'}
                </span>
              </div>

              <h2 className="text-lg font-bold text-white mt-1">{plan.name}</h2>
              <p className="text-xs text-neutral-400 mt-1 min-h-[32px]">{plan.tagline}</p>

              <div className="mt-4 pt-4 border-t border-neutral-800">
                <div className="text-2xl font-mono font-bold text-[var(--gold-primary)]">
                  {formatCurrency(plan.monthlyPrice, currency)}
                </div>
                <div className="text-[11px] text-neutral-400">
                  o {formatCurrency(plan.annualPrice, currency)} facturado anual
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <div className="text-[11px] text-neutral-500 uppercase font-semibold">Límites:</div>
                <div className="text-neutral-300 flex items-center justify-between">
                  <span>Capacidad de sillas:</span>
                  <span className="font-bold text-white font-mono">{plan.maxBarbers} {plan.maxBarbers === 1 ? 'barbero' : 'barberos'}</span>
                </div>
                <div className="text-neutral-300 flex items-center justify-between">
                  <span>Fotos en portafolio:</span>
                  <span className="font-bold text-white font-mono">{plan.maxPortfolioImages} fotos</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-neutral-800 space-y-2">
                <div className="text-[11px] text-neutral-500 uppercase font-semibold">Incluye:</div>
                {plan.features.map((feat, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-neutral-300">
                    <Check className="w-3.5 h-3.5 text-[var(--gold-primary)] shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-neutral-800 flex items-center justify-between gap-2">
              <button
                onClick={() => handleToggleActive(plan)}
                className="p-2 rounded-lg bg-[#202020] text-neutral-300 hover:text-white"
                title={plan.isActive ? 'Desactivar plan' : 'Activar plan'}
              >
                {plan.isActive ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-neutral-500" />}
              </button>
              <button
                onClick={() => handleDuplicate(plan)}
                className="p-2 rounded-lg bg-[#202020] text-neutral-300 hover:text-white"
                title="Duplicar plan"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleEdit(plan)}
                className="flex-1 py-2 rounded-lg bg-[#242424] hover:bg-[var(--gold-primary)] hover:text-black font-semibold text-xs text-white transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Create Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
              <h3 className="text-base font-bold text-white">
                {editingPlan.id ? 'Editar Plan Comercial' : 'Crear Nuevo Plan'}
              </h3>
              <button
                onClick={() => setEditingPlan(null)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Nombre del Plan</label>
                <input
                  type="text"
                  value={form.name || ''}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Audiencia Objetivo</label>
                <select
                  value={form.audience}
                  onChange={e => setForm({ ...form, audience: e.target.value as any })}
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                >
                  <option value="barbershop">Barbería Comercial (Equipo)</option>
                  <option value="independent">Barbero Independiente (Autónomo)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Precio Mensual (COP)</label>
                  <input
                    type="number"
                    value={form.monthlyPrice || 0}
                    onChange={e => setForm({ ...form, monthlyPrice: Number(e.target.value) })}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Precio Anual (COP)</label>
                  <input
                    type="number"
                    value={form.annualPrice || 0}
                    onChange={e => setForm({ ...form, annualPrice: Number(e.target.value) })}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Máx. Barberos / Sillas</label>
                  <input
                    type="number"
                    value={form.maxBarbers || 1}
                    onChange={e => setForm({ ...form, maxBarbers: Number(e.target.value) })}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Límite Portafolio</label>
                  <input
                    type="number"
                    max={10}
                    value={form.maxPortfolioImages || 10}
                    onChange={e => setForm({ ...form, maxPortfolioImages: Number(e.target.value) })}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Frase Comercial / Tagline</label>
                <input
                  type="text"
                  value={form.tagline || ''}
                  onChange={e => setForm({ ...form, tagline: e.target.value })}
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#262626] flex justify-end gap-2">
              <button
                onClick={() => setEditingPlan(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--gold-primary)] text-black hover:bg-[var(--gold-hover)]"
              >
                Guardar Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
