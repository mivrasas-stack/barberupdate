import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { CreditCard, Calendar, CheckCircle2, AlertCircle, RefreshCw, Layers } from 'lucide-react';

export const AdminSubscriptions: React.FC = () => {
  const { state, currency, addToast } = useApp();

  const handleSimulateRenewal = (businessName: string) => {
    addToast(`Renovación simulada con éxito para ${businessName}`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Facturación SaaS
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Suscripciones Recurrentes</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Monitorea el ciclo de vida, renovaciones y cobros de planes de la plataforma
          </p>
        </div>
      </div>

      {/* Subscription Cards & Table */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#262626] bg-[#181818] text-neutral-400">
                <th className="py-3.5 px-4 font-semibold">Cliente / Negocio</th>
                <th className="py-3.5 px-4 font-semibold">Tipo</th>
                <th className="py-3.5 px-4 font-semibold">Plan Contratado</th>
                <th className="py-3.5 px-4 font-semibold">Importe Recurrente</th>
                <th className="py-3.5 px-4 font-semibold">Próxima Renovación</th>
                <th className="py-3.5 px-4 font-semibold">Estado</th>
                <th className="py-3.5 px-4 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e]">
              {/* Shops */}
              {state.barbershops.map(shop => {
                const plan = state.plans.find(p => p.id === shop.planId) || state.plans[2];
                return (
                  <tr key={shop.id} className="hover:bg-[#181818] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2.5">
                      <img src={shop.logo} alt={shop.name} className="w-7 h-7 rounded-lg object-cover" />
                      <div>
                        <div>{shop.name}</div>
                        <div className="text-[11px] text-neutral-500 font-mono">/{shop.slug}</div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300">Barbería Comercial</td>
                    <td className="py-3.5 px-4 font-medium text-[var(--gold-primary)]">{plan.name}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      {formatCurrency(plan.monthlyPrice, currency)} / mes
                    </td>
                    <td className="py-3.5 px-4 font-mono text-neutral-400">{shop.subscriptionRenewsAt}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Activa
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleSimulateRenewal(shop.name)}
                        className="px-2.5 py-1 rounded-lg bg-[#242424] hover:bg-[var(--gold-primary)] hover:text-black text-neutral-200 text-xs font-semibold transition-colors"
                      >
                        Simular Cobro
                      </button>
                    </td>
                  </tr>
                );
              })}

              {/* Independent Barbers */}
              {state.barbers
                .filter(b => b.isIndependent)
                .map(barber => {
                  const plan = state.plans.find(p => p.id === 'plan-ind-elite') || state.plans[1];
                  return (
                    <tr key={barber.id} className="hover:bg-[#181818] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2.5">
                        <img src={barber.photo} alt={barber.name} className="w-7 h-7 rounded-full object-cover" />
                        <div>
                          <div>{barber.name}</div>
                          <div className="text-[11px] text-neutral-500 font-mono">/barbero/{barber.slug}</div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-orange-400">Barbero Independiente</td>
                      <td className="py-3.5 px-4 font-medium text-[var(--gold-primary)]">{plan.name}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {formatCurrency(plan.monthlyPrice, currency)} / mes
                      </td>
                      <td className="py-3.5 px-4 font-mono text-neutral-400">2026-11-20</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Activa
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleSimulateRenewal(barber.name)}
                          className="px-2.5 py-1 rounded-lg bg-[#242424] hover:bg-[var(--gold-primary)] hover:text-black text-neutral-200 text-xs font-semibold transition-colors"
                        >
                          Simular Cobro
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
