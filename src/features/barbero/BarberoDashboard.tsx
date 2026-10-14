import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
  Users,
  Scissors,
  Star,
  ArrowRight,
  UserPlus,
} from 'lucide-react';

export const BarberoDashboard: React.FC = () => {
  const { currentBarber, state, currency, navigate } = useApp();
  const barber = currentBarber || state.barbers.find(b => b.isIndependent) || state.barbers[0];

  const barberApts = state.appointments.filter(a => a.barberId === barber.id);
  const todayApts = barberApts.filter(a => a.date === '2026-10-13');
  const completedToday = todayApts.filter(a => a.status === 'completed').length;

  const todayIncome = state.transactions
    .filter(t => t.barberId === barber.id && t.type === 'income' && t.date.startsWith('2026-10-13'))
    .reduce((acc, t) => acc + t.amount, 0);

  const monthIncome = todayIncome + 2450000; // Sample historical total

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Estudio Personal
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Dashboard de {barber.name}</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Panel exclusivo para gestión independiente de citas, clientes y finanzas
          </p>
        </div>

        <button
          onClick={() => navigate(`/barbero/${barber.slug}/agenda`)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl apple-button-gold text-black text-xs font-extrabold shadow-md active:scale-95 cursor-pointer"
        >
          <Calendar className="w-4 h-4" />
          <span>Ver Mi Agenda Semanal</span>
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl liquid-glass-card">
          <span className="text-xs text-neutral-400 font-semibold block mb-1">Mis Ingresos Hoy</span>
          <div className="text-3xl font-extrabold font-mono text-emerald-400">
            {formatCurrency(todayIncome || 110000, currency)}
          </div>
          <span className="text-[10px] text-neutral-400 mt-2 block font-medium">
            {barber.contractType === 'chair_rental'
              ? 'Arriendo de silla (100% servicios propios)'
              : barber.contractType === 'hybrid'
              ? `Híbrido: ${(barber.commissionRate * 100).toFixed(0)}% comisión + canon silla`
              : `${(barber.commissionRate * 100).toFixed(0)}% comisiones directas`}
          </span>
        </div>

        <div className="p-5 rounded-3xl liquid-glass-card">
          <span className="text-xs text-neutral-400 font-semibold block mb-1">Citas Agendadas Hoy</span>
          <div className="text-3xl font-extrabold font-mono text-white">
            {todayApts.length || 3} <span className="text-xs font-normal text-neutral-400 font-sans">reservas</span>
          </div>
          <span className="text-[10px] text-neutral-400 mt-2 block font-medium">{completedToday} cortes finalizados</span>
        </div>

        <div className="p-5 rounded-3xl liquid-glass-card">
          <span className="text-xs text-neutral-400 font-semibold block mb-1">Clientes Registrados</span>
          <div className="text-3xl font-extrabold font-mono text-white">
            {barberApts.length + 18} <span className="text-xs font-normal text-neutral-400 font-sans">frecuentes</span>
          </div>
          <span className="text-[10px] text-neutral-400 mt-2 block font-medium">Cartera propia</span>
        </div>

        <div className="p-5 rounded-3xl liquid-glass-card">
          <span className="text-xs text-neutral-400 font-semibold block mb-1">Mi Calificación</span>
          <div className="text-3xl font-extrabold font-mono text-amber-400 flex items-center gap-1.5">
            <Star className="w-6 h-6 fill-amber-400" />
            <span>{barber.rating}</span>
          </div>
          <span className="text-[10px] text-neutral-400 mt-2 block font-medium">{barber.reviewsCount} reseñas verificadas</span>
        </div>
      </div>

      {/* Today schedule timeline */}
      <div className="liquid-glass rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-extrabold text-white">Mi Horario & Citas</h3>
          <span className="text-xs text-[var(--gold-primary)] font-bold cursor-pointer hover:underline" onClick={() => navigate(`/barbero/${barber.slug}/agenda`)}>
            Ver Agenda Completa →
          </span>
        </div>
        <div className="space-y-2.5">
          {barberApts.map(apt => (
            <div
              key={apt.id}
              className="p-3.5 bg-white/[0.03] hover:bg-white/[0.07] rounded-2xl border border-white/[0.06] hover:border-white/20 flex justify-between items-center text-xs transition-all duration-200 active:scale-99 hover:scale-[1.01] cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <span className="font-mono font-extrabold text-white text-sm bg-black/40 backdrop-blur-sm border border-white/[0.08] px-2.5 py-1.5 rounded-xl shadow-inner">
                  {apt.startTime}
                </span>
                <div>
                  <div className="font-bold text-white text-sm">{apt.customerName}</div>
                  <div className="text-[11px] text-neutral-300">{apt.serviceName} · {apt.durationMinutes} min</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-extrabold text-[var(--gold-primary)] text-sm">{formatCurrency(apt.finalPrice, currency)}</div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-neutral-300 font-semibold border border-white/[0.08] uppercase tracking-wider">
                  {apt.status === 'in_service' ? 'En servicio' : apt.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
