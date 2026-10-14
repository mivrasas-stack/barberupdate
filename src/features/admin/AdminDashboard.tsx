import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import {
  Users,
  Store,
  Scissors,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronRight,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { state, currency, navigate } = useApp();
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  // Compute aggregated real stats from store
  const totalUsers = state.users.length;
  const totalShops = state.barbershops.length;
  const totalIndependentBarbers = state.barbers.filter(b => b.isIndependent).length;
  const totalAssociatedBarbers = state.barbers.filter(b => !b.isIndependent).length;

  // Platform subscriptions revenue (MRR)
  const activeSubsCount = state.barbershops.filter(s => s.subscriptionStatus === 'active').length + totalIndependentBarbers;
  const estimatedMRR = state.barbershops.reduce((acc, s) => {
    const plan = state.plans.find(p => p.id === s.planId);
    return acc + (plan?.monthlyPrice || 149000);
  }, 0) + (totalIndependentBarbers * 89000);

  const estimatedARR = estimatedMRR * 12;

  // Total cuts revenue processed across all shops (distinct from platform MRR)
  const totalGrossHaircutVolume = state.transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Panel Ejecutivo de Supervisión
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Dashboard Global de Plataforma</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Métricas multi-inquilino de franquicias, barberos independientes y suscripciones SaaS
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 p-1 bg-[#161616] border border-[#2a2a2a] rounded-xl self-start sm:self-auto text-xs">
          <button
            onClick={() => setPeriod('month')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              period === 'month' ? 'bg-[var(--gold-primary)] text-black font-bold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Este Mes
          </button>
          <button
            onClick={() => setPeriod('quarter')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              period === 'quarter' ? 'bg-[var(--gold-primary)] text-black font-bold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Trimestre
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              period === 'year' ? 'bg-[var(--gold-primary)] text-black font-bold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Año 2026
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR SaaS */}
        <div className="p-4 rounded-2xl bg-[#141414] border border-[#262626] relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">MRR Recurrente Plataforma</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              +18.4%
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--gold-primary)]">
            {formatCurrency(estimatedMRR, currency)}
          </div>
          <div className="mt-2 text-[11px] text-neutral-500 flex items-center justify-between">
            <span>ARR proyectado:</span>
            <span className="font-mono text-neutral-300">{formatCurrency(estimatedARR, currency)}</span>
          </div>
        </div>

        {/* Barberías Activas */}
        <div className="p-4 rounded-2xl bg-[#141414] border border-[#262626]">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">Barberías Comerciales</span>
            <Store className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {totalShops} <span className="text-xs font-normal text-neutral-400 font-sans">locales</span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-500 flex items-center justify-between">
            <span>Barberos asociados:</span>
            <span className="font-mono text-neutral-300">{totalAssociatedBarbers} profesionales</span>
          </div>
        </div>

        {/* Barberos Independientes */}
        <div className="p-4 rounded-2xl bg-[#141414] border border-[#262626]">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">Barberos Independientes</span>
            <Scissors className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {totalIndependentBarbers} <span className="text-xs font-normal text-neutral-400 font-sans">suscritos</span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-500 flex items-center justify-between">
            <span>Plan Élite:</span>
            <span className="font-mono text-neutral-300">100% activos</span>
          </div>
        </div>

        {/* Volumen de Cortes Procesados */}
        <div className="p-4 rounded-2xl bg-[#141414] border border-[#262626]">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">GMV Cortes & Boutique</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {formatCurrency(totalGrossHaircutVolume, currency)}
          </div>
          <div className="mt-2 text-[11px] text-neutral-500 flex items-center justify-between">
            <span>Volumen transaccional</span>
            <span className="text-neutral-400 text-[10px]">Cortes + Tienda</span>
          </div>
        </div>
      </div>

      {/* Two Column Section: Revenue Distinction & System Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Plan Distribution & Revenue Split */}
        <div className="lg:col-span-7 bg-[#141414] border border-[#262626] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white">Distribución por Planes de Suscripción</h2>
              <p className="text-[11px] text-neutral-400">Ingresos netos de software recurrentes</p>
            </div>
            <button
              onClick={() => navigate('/admin/planes')}
              className="text-xs text-[var(--gold-primary)] hover:underline flex items-center gap-1"
            >
              <span>Ver planes</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {state.plans.map(plan => {
              const activeCount = plan.audience === 'barbershop'
                ? state.barbershops.filter(s => s.planId === plan.id).length
                : state.barbers.filter(b => b.isIndependent).length;
              const revenue = activeCount * plan.monthlyPrice;

              return (
                <div key={plan.id} className="p-3 bg-[#181818] rounded-xl border border-[#262626]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-white">{plan.name}</span>
                    <span className="text-xs font-mono font-bold text-[var(--gold-primary)]">
                      {formatCurrency(revenue, currency)} / mes
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span>
                      {plan.audience === 'barbershop' ? 'Barberías Comerciales' : 'Profesionales Independientes'} · {activeCount} activos
                    </span>
                    <span className="font-mono">{formatCurrency(plan.monthlyPrice, currency)}/cuenta</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-3 rounded-xl bg-[#101010] border border-neutral-800 text-[11px] text-neutral-400 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Aislamiento Contable:</strong> Los ingresos de suscripciones SaaS pertenecen a la plataforma central, mientras que los ingresos de cortes de cabello y boutique pertenecen a cada negocio independiente.
            </span>
          </div>
        </div>

        {/* Right Column: Alerts & Recent Activity */}
        <div className="lg:col-span-5 bg-[#141414] border border-[#262626] rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white">Alertas Administrativas</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                2 Notificaciones
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs">
                <div className="flex items-center gap-2 text-amber-400 font-semibold mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Renovación Próxima: Imperio Barber Cali</span>
                </div>
                <p className="text-neutral-400 text-[11px]">
                  La suscripción del plan Pro Imperio vence el 25 de Octubre de 2026. Facturación automática programada.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs">
                <div className="flex items-center gap-2 text-blue-400 font-semibold mb-1">
                  <Store className="w-3.5 h-3.5" />
                  <span>Nueva Barbería Registrada</span>
                </div>
                <p className="text-neutral-400 text-[11px]">
                  La Cueva Vintage Barbershop completó su configuración de servicios y 2 barberos asociados.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-neutral-800">
            <button
              onClick={() => navigate('/admin/usuarios')}
              className="w-full py-2.5 rounded-xl bg-[#202020] hover:bg-[#282828] text-xs font-semibold text-white transition-colors flex items-center justify-center gap-2"
            >
              <span>Explorar los {totalUsers} usuarios registrados</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Latest Barbershops Table */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-white">Últimas Barberías y Franquicias</h2>
            <p className="text-[11px] text-neutral-400">Negocios registrados en BarberOS</p>
          </div>
          <button
            onClick={() => navigate('/admin/franquicias')}
            className="text-xs text-[var(--gold-primary)] hover:underline"
          >
            Ver todas
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#262626] text-neutral-400">
                <th className="pb-3 font-semibold">Barbería</th>
                <th className="pb-3 font-semibold">Ciudad</th>
                <th className="pb-3 font-semibold">Plan</th>
                <th className="pb-3 font-semibold">Barberos</th>
                <th className="pb-3 font-semibold">Rating</th>
                <th className="pb-3 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e]">
              {state.barbershops.map(shop => {
                const barbersCount = state.barbers.filter(b => b.businessId === shop.id).length;
                return (
                  <tr key={shop.id} className="hover:bg-[#181818] transition-colors">
                    <td className="py-3 font-medium text-white flex items-center gap-2.5">
                      <img src={shop.logo} alt={shop.name} className="w-7 h-7 rounded-lg object-cover border border-neutral-700" />
                      <div>
                        <div>{shop.name}</div>
                        <div className="text-[11px] text-neutral-500 font-mono">/{shop.slug}</div>
                      </div>
                    </td>
                    <td className="py-3 text-neutral-300">{shop.city}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#D9A323]/15 text-[#D9A323] border border-[#D9A323]/30">
                        {shop.planId === 'plan-shop-pro' ? 'Pro Imperio' : 'Estudio'}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-neutral-300">{barbersCount} sillas</td>
                    <td className="py-3 text-amber-400 font-mono">★ {shop.rating}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => navigate(`/barberia/${shop.slug}/dashboard`)}
                        className="text-xs font-semibold text-[var(--gold-primary)] hover:underline"
                      >
                        Abrir Panel
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
