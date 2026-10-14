import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency, exportToCSV } from '../../utils/formatters';
import { FileSpreadsheet, Download, TrendingUp, Calendar, BarChart3, Filter } from 'lucide-react';

export const BarberiaReportes: React.FC = () => {
  const { currentShop, state, currency, addToast } = useApp();
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');

  const shopId = currentShop?.id || 'shop-1';
  const shopTxns = state.transactions.filter(t => t.businessId === shopId);
  const barbers = state.barbers.filter(b => b.businessId === shopId);

  const handleExportFullReport = () => {
    const rows = shopTxns.map(t => ({
      ID: t.id,
      Fecha: t.date,
      Tipo: t.type,
      Concepto: t.concept,
      Monto: t.amount,
      Metodo: t.paymentMethod,
    }));
    exportToCSV(`reporte_detallado_${shopId}`, rows);
    addToast('Reporte financiero completo descargado en CSV', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Analítica Financiera
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Reportes de Rendimiento</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Informes consolidados listos para contabilidad y análisis de rentabilidad por silla
          </p>
        </div>

        <button
          onClick={handleExportFullReport}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--gold-primary)] text-black text-xs font-bold hover:bg-[var(--gold-hover)]"
        >
          <Download className="w-4 h-4" />
          <span>Descargar Reporte CSV</span>
        </button>
      </div>

      {/* Barber Performance Report */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white">Rendimiento y Comisiones por Barbero</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#262626] text-neutral-400">
                <th className="pb-3 font-semibold">Barbero</th>
                <th className="pb-3 font-semibold">Cortes Realizados</th>
                <th className="pb-3 font-semibold">Ventas Totales</th>
                <th className="pb-3 font-semibold">Comisión (%)</th>
                <th className="pb-3 font-semibold">Pago Barbero</th>
                <th className="pb-3 font-semibold text-right">Margen Barbería</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e]">
              {barbers.map(barber => {
                const cuts = state.appointments.filter(a => a.barberId === barber.id && a.status === 'completed');
                const volume = cuts.reduce((acc, c) => acc + c.finalPrice, 0);
                const barberPay = volume * barber.commissionRate;
                const shopMargin = volume - barberPay;

                return (
                  <tr key={barber.id} className="hover:bg-[#181818] transition-colors">
                    <td className="py-3 font-bold text-white flex items-center gap-2.5">
                      <img src={barber.photo} alt={barber.name} className="w-7 h-7 rounded-full object-cover" />
                      <span>{barber.name}</span>
                    </td>
                    <td className="py-3 font-mono text-neutral-300">{cuts.length} servicios</td>
                    <td className="py-3 font-mono font-bold text-white">{formatCurrency(volume, currency)}</td>
                    <td className="py-3 font-mono text-[var(--gold-primary)]">{(barber.commissionRate * 100).toFixed(0)}%</td>
                    <td className="py-3 font-mono text-emerald-400">{formatCurrency(barberPay, currency)}</td>
                    <td className="py-3 text-right font-mono font-bold text-white">{formatCurrency(shopMargin, currency)}</td>
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
