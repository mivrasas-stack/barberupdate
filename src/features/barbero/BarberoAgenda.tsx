import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { barberStore } from '../../services/store';
import { formatCurrency, getColombiaDateString } from '../../utils/formatters';
import { Appointment, PaymentMethod } from '../../types';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Check,
  X,
  User,
  Star,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Scissors,
  Sparkles,
} from 'lucide-react';

export const BarberoAgenda: React.FC = () => {
  const { currentBarber, state, currency, addToast } = useApp();
  const defaultBarber = currentBarber || state.barbers.find(b => b.isIndependent) || state.barbers[0];
  const [selectedBarberId, setSelectedBarberId] = useState<string>(defaultBarber.id);
  const barber = state.barbers.find(b => b.id === selectedBarberId) || defaultBarber;

  // View mode: 'week' by default as requested by user
  const [viewMode, setViewMode] = useState<'week' | 'day' | 'list'>('week');

  // Reference date (defaults to current date in Colombia)
  const [currentDateStr, setCurrentDateStr] = useState(() => getColombiaDateString());

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [inspectingApt, setInspectingApt] = useState<Appointment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('nequi');

  // New appointment form state
  const [formCustName, setFormCustName] = useState('');
  const [formCustPhone, setFormCustPhone] = useState('');
  const [formServiceId, setFormServiceId] = useState(state.services[0]?.id || '');
  const [formDate, setFormDate] = useState(() => getColombiaDateString());
  const [formTime, setFormTime] = useState('11:00');
  const [formNotes, setFormNotes] = useState('');

  // Calculate the 7 days of the active week (Monday to Sunday)
  const getDaysOfWeek = (baseDateStr: string) => {
    const base = new Date(baseDateStr + 'T12:00:00');
    const dayOfWeek = base.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(base);
    monday.setDate(base.getDate() + diffToMonday);

    const days = [];
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const shortNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      days.push({
        date: iso,
        dayName: dayNames[i],
        shortName: shortNames[i],
        dayNumber: d.getDate(),
        monthName: d.toLocaleString('es-CO', { month: 'short' }),
        isToday: iso === '2026-10-13',
      });
    }
    return days;
  };

  const weekDays = getDaysOfWeek(currentDateStr);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  // Filter appointments of this barber
  const allBarberApts = state.appointments.filter(a => a.barberId === barber.id);

  // Appointments in this week
  const weekAppointments = allBarberApts.filter(a =>
    weekDays.some(w => w.date === a.date)
  );

  // Aggregated weekly metrics
  const weekTotalRevenue = weekAppointments
    .filter(a => a.status !== 'cancelled')
    .reduce((acc, a) => acc + a.finalPrice, 0);

  const weekTotalMinutes = weekAppointments
    .filter(a => a.status !== 'cancelled')
    .reduce((acc, a) => acc + a.durationMinutes, 0);

  const weekCompletedCount = weekAppointments.filter(a => a.status === 'completed').length;

  // Time grid slots (08:00 to 20:00)
  const gridHours = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
    '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
  ];

  const myServices = state.services.filter(s => !s.businessId || s.barberIds.includes(barber.id));

  // Navigation handlers
  const handlePrevWeek = () => {
    const cur = new Date(currentDateStr + 'T12:00:00');
    cur.setDate(cur.getDate() - 7);
    setCurrentDateStr(cur.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const cur = new Date(currentDateStr + 'T12:00:00');
    cur.setDate(cur.getDate() + 7);
    setCurrentDateStr(cur.toISOString().split('T')[0]);
  };

  const handleGoToday = () => {
    setCurrentDateStr(getColombiaDateString());
  };

  // Open creation modal prefilled with clicked day and time
  const handleSlotClick = (dateStr: string, hourStr: string) => {
    setFormDate(dateStr);
    setFormTime(hourStr);
    setFormCustName('');
    setFormCustPhone('');
    setIsNewModalOpen(true);
  };

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const service = state.services.find(s => s.id === formServiceId) || state.services[0];
    const res = barberStore.createAppointment({
      barberId: barber.id,
      customerId: `cust-${Date.now()}`,
      customerName: formCustName,
      customerPhone: formCustPhone,
      serviceId: service.id,
      serviceName: service.name,
      date: formDate,
      startTime: formTime,
      endTime: '12:00',
      durationMinutes: service.durationMinutes,
      price: service.price,
      discount: 0,
      finalPrice: service.price,
      status: 'confirmed',
      notes: formNotes || 'Cita agendada desde agenda semanal',
    });

    if (!res.success) {
      addToast(res.error || 'Horario no disponible', 'error');
      return;
    }
    addToast(`Cita agendada para ${formCustName} el ${formDate} a las ${formTime}`, 'success');
    setIsNewModalOpen(false);
  };

  const handleCompleteAppointment = () => {
    if (!inspectingApt) return;
    barberStore.updateAppointmentStatus(inspectingApt.id, 'completed', paymentMethod);
    addToast(`Corte finalizado. Ingreso de ${formatCurrency(inspectingApt.finalPrice, currency)} registrado.`, 'success');
    setInspectingApt(null);
  };

  const handleCancelAppointment = (id: string) => {
    barberStore.updateAppointmentStatus(id, 'cancelled');
    addToast('Cita cancelada', 'info');
    setInspectingApt(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">
            Agenda Profesional
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Agenda Semanal de {barber.name}</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Visualiza y administra todas tus citas programadas de lunes a domingo
          </p>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center gap-1 p-1 bg-black/40 backdrop-blur-md border border-white/[0.08] rounded-full text-xs shadow-inner">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all duration-200 cursor-pointer active:scale-95 ${
                viewMode === 'week'
                  ? 'bg-gradient-to-b from-[#f3c048] to-[#c9931b] text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Semana Completa
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all duration-200 cursor-pointer active:scale-95 ${
                viewMode === 'day'
                  ? 'bg-gradient-to-b from-[#f3c048] to-[#c9931b] text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Día
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all duration-200 cursor-pointer active:scale-95 ${
                viewMode === 'list'
                  ? 'bg-gradient-to-b from-[#f3c048] to-[#c9931b] text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Lista
            </button>
          </div>

          <button
            onClick={() => {
              setFormDate(currentDateStr);
              setFormTime('11:00');
              setIsNewModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl apple-button-gold text-black text-xs font-extrabold transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nueva Cita</span>
          </button>
        </div>
      </div>

      {/* Barber Selector Strip */}
      <div className="bg-[#141418]/80 backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-3 flex flex-wrap items-center gap-2 shadow-[0_8px_30px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.08)]">
        <span className="text-xs font-semibold text-neutral-400 mr-2 flex items-center gap-1.5">
          <Scissors className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
          Ver agenda de:
        </span>
        {state.barbers.map(b => {
          const isSelected = barber.id === b.id;
          const countWeek = state.appointments.filter(
            a => a.barberId === b.id && weekDays.some(w => w.date === a.date) && a.status !== 'cancelled'
          ).length;

          return (
            <button
              key={b.id}
              onClick={() => setSelectedBarberId(b.id)}
              className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl text-xs font-semibold border transition-all duration-200 cursor-pointer active:scale-95 ${
                isSelected
                  ? 'bg-gradient-to-b from-[#f5c754] to-[#c9931b] text-black border-transparent font-extrabold shadow-[0_4px_16px_rgba(217,163,35,0.35)]'
                  : 'bg-white/[0.04] text-neutral-300 border-white/[0.07] hover:border-white/20 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              <img
                src={b.photo}
                alt={b.name}
                className="w-5 h-5 rounded-full object-cover ring-1 ring-black/30"
              />
              <span>{b.name}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  isSelected ? 'bg-black/20 text-black' : 'bg-white/[0.08] text-neutral-300'
                }`}
              >
                {countWeek} citas
              </span>
            </button>
          );
        })}
      </div>

      {/* Weekly Navigation & KPI Ribbon */}
      <div className="bg-[#141418]/80 backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_10px_35px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.08)]">
        {/* Week Navigator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevWeek}
              className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-neutral-300 hover:text-white hover:bg-white/[0.09] transition-all cursor-pointer active:scale-95"
              title="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextWeek}
              className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-neutral-300 hover:text-white hover:bg-white/[0.09] transition-all cursor-pointer active:scale-95"
              title="Semana siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleGoToday}
            className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-neutral-200 hover:text-white text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            Semana Actual
          </button>

          <div className="text-xs pl-2">
            <span className="text-neutral-400 block text-[10px] uppercase font-bold tracking-wider">Semana activa:</span>
            <span className="font-extrabold text-white text-sm">
              {weekStart.dayNumber} {weekStart.monthName} — {weekEnd.dayNumber} {weekEnd.monthName} de 2026
            </span>
          </div>
        </div>

        {/* Weekly Metrics Strip */}
        <div className="flex items-center gap-5 text-xs font-mono pt-3 md:pt-0 border-t md:border-t-0 border-white/[0.08]">
          <div className="text-right">
            <span className="text-[10px] text-neutral-400 font-sans block font-semibold uppercase">Total Semana</span>
            <span className="font-extrabold text-white text-base">{weekAppointments.length} citas</span>
          </div>
          <div className="h-8 w-px bg-white/[0.08]" />
          <div className="text-right">
            <span className="text-[10px] text-neutral-400 font-sans block font-semibold uppercase">Ingresos Est.</span>
            <span className="font-extrabold text-[var(--gold-primary)] text-base">{formatCurrency(weekTotalRevenue, currency)}</span>
          </div>
          <div className="h-8 w-px bg-white/[0.08]" />
          <div className="text-right">
            <span className="text-[10px] text-neutral-400 font-sans block font-semibold uppercase">Completadas</span>
            <span className="font-extrabold text-emerald-400 text-base">{weekCompletedCount}</span>
          </div>
        </div>
      </div>

      {/* WEEKLY CALENDAR MATRIX VIEW */}
      {viewMode === 'week' && (
        <div className="bg-[#141418]/90 backdrop-blur-2xl border border-white/[0.08] rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)] animate-apple-enter">
          <div className="overflow-x-auto">
            <div className="min-w-[850px]">
              {/* Header Row: 7 Days of the Week */}
              <div className="grid grid-cols-8 border-b border-white/[0.08] bg-black/40 backdrop-blur-md sticky top-0 z-20">
                {/* Time slot column title */}
                <div className="p-3.5 text-center border-r border-white/[0.08] text-neutral-500 text-[10px] font-mono uppercase font-bold flex items-center justify-center">
                  Hora
                </div>

                {/* 7 Days Columns */}
                {weekDays.map(day => {
                  const dayAptsCount = weekAppointments.filter(a => a.date === day.date && a.status !== 'cancelled').length;
                  return (
                    <div
                      key={day.date}
                      className={`p-3 text-center border-r border-white/[0.08] last:border-r-0 transition-colors ${
                        day.isToday ? 'bg-[var(--gold-primary)]/[0.08] ring-1 ring-inset ring-[var(--gold-primary)]/30' : ''
                      }`}
                    >
                      <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                        {day.dayName}
                      </div>
                      <div className="flex items-center justify-center gap-1.5 mt-0.5">
                        <span className={`text-base font-extrabold font-mono ${day.isToday ? 'text-[var(--gold-primary)]' : 'text-white'}`}>
                          {day.dayNumber}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-medium">{day.monthName}</span>
                      </div>
                      <div className="mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                          dayAptsCount > 0
                            ? 'bg-white/[0.08] text-[var(--gold-primary)] font-bold border border-[var(--gold-primary)]/20'
                            : 'text-neutral-500'
                        }`}>
                          {dayAptsCount} {dayAptsCount === 1 ? 'cita' : 'citas'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grid Body: Hours vs Days */}
              <div className="divide-y divide-white/[0.05]">
                {gridHours.map(hour => {
                  return (
                    <div key={hour} className="grid grid-cols-8 min-h-[92px]">
                      {/* Left Hour Column */}
                      <div className="p-2.5 text-center border-r border-white/[0.08] bg-black/25 text-xs font-mono font-bold text-neutral-400 flex items-start justify-center pt-3">
                        {hour}
                      </div>

                      {/* 7 Days Cells */}
                      {weekDays.map(day => {
                        // Find appointment starting around this hour (e.g. 10:00, 10:30)
                        const hourPrefix = hour.split(':')[0];
                        const aptsInSlot = weekAppointments.filter(a => {
                          if (a.date !== day.date) return false;
                          const aptHour = a.startTime.split(':')[0];
                          return aptHour === hourPrefix;
                        });

                        return (
                          <div
                            key={day.date}
                            className={`p-1.5 border-r border-white/[0.08] last:border-r-0 relative group transition-colors ${
                              day.isToday ? 'bg-[var(--gold-primary)]/[0.02]' : 'hover:bg-white/[0.02]'
                            }`}
                          >
                            {/* If appointments exist in this cell */}
                            {aptsInSlot.length > 0 ? (
                              <div className="space-y-1.5">
                                {aptsInSlot.map(apt => {
                                  let badgeColor = 'bg-white/[0.05] border-white/[0.1] text-white hover:border-white/30';
                                  if (apt.status === 'completed') {
                                    badgeColor = 'bg-emerald-500/[0.1] border-emerald-500/35 text-emerald-300 hover:border-emerald-500/60 shadow-[0_4px_16px_rgba(16,185,129,0.15)]';
                                  } else if (apt.status === 'in_service') {
                                    badgeColor = 'bg-[var(--gold-primary)]/[0.15] border-[var(--gold-primary)]/80 text-[var(--gold-primary)] animate-pulse shadow-[0_4px_20px_rgba(217,163,35,0.25)]';
                                  } else if (apt.status === 'waiting') {
                                    badgeColor = 'bg-amber-500/[0.12] border-amber-500/40 text-amber-300 hover:border-amber-500/60 shadow-[0_4px_16px_rgba(245,158,11,0.15)]';
                                  } else if (apt.status === 'confirmed') {
                                    badgeColor = 'bg-blue-500/[0.1] border-blue-500/35 text-blue-200 hover:border-blue-500/60 shadow-[0_4px_16px_rgba(59,130,246,0.15)]';
                                  }

                                  return (
                                    <button
                                      key={apt.id}
                                      onClick={() => setInspectingApt(apt)}
                                      className={`w-full text-left p-2.5 rounded-2xl border ${badgeColor} backdrop-blur-md shadow-md transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] cursor-pointer block group/card`}
                                    >
                                      <div className="flex items-center justify-between text-[10px] font-mono">
                                        <span className="font-extrabold">{apt.startTime}</span>
                                        <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded-full bg-black/30 backdrop-blur-sm border border-white/[0.05]">
                                          {apt.status === 'in_service' ? 'En corte' : apt.status === 'waiting' ? 'En espera' : apt.status}
                                        </span>
                                      </div>
                                      <div className="text-xs font-bold text-white truncate mt-1 group-hover/card:text-[var(--gold-primary)] transition-colors">
                                        {apt.customerName}
                                      </div>
                                      <div className="text-[10px] text-neutral-300 truncate">
                                        {apt.serviceName}
                                      </div>
                                      <div className="text-[11px] font-mono font-extrabold text-[var(--gold-primary)] mt-1.5">
                                        {formatCurrency(apt.finalPrice, currency)}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              /* Empty slot: Click to add appointment */
                              <button
                                onClick={() => handleSlotClick(day.date, hour)}
                                className="w-full h-full min-h-[72px] rounded-xl border border-transparent hover:border-dashed hover:border-white/20 hover:bg-white/[0.03] flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-all duration-200 text-neutral-400 hover:text-[var(--gold-primary)] cursor-pointer active:scale-95"
                                title={`Agendar cita el ${day.dayName} a las ${hour}`}
                              >
                                <Plus className="w-4 h-4" />
                                <span className="text-[10px] font-semibold mt-0.5">+ Agendar</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DAY VIEW ALTERNATIVE */}
      {viewMode === 'day' && (
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800 text-xs">
            <span className="font-bold text-white">Citas del día {currentDateStr}</span>
            <input
              type="date"
              value={currentDateStr}
              onChange={e => setCurrentDateStr(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-white"
            />
          </div>

          <div className="space-y-2">
            {allBarberApts.filter(a => a.date === currentDateStr).length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500">
                No hay citas registradas para este día específico.
              </div>
            ) : (
              allBarberApts.filter(a => a.date === currentDateStr).map(apt => (
                <div
                  key={apt.id}
                  onClick={() => setInspectingApt(apt)}
                  className="p-3.5 rounded-xl bg-[#181818] border border-neutral-800 hover:border-[var(--gold-primary)] flex items-center justify-between text-xs cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-base text-white bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
                      {apt.startTime}
                    </span>
                    <div>
                      <div className="font-bold text-white text-sm">{apt.customerName}</div>
                      <div className="text-neutral-400 text-[11px]">{apt.serviceName} · {apt.durationMinutes} min</div>
                      <div className="text-neutral-500 text-[10px] font-mono">{apt.customerPhone}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-base text-[var(--gold-primary)]">
                      {formatCurrency(apt.finalPrice, currency)}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                      {apt.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* LIST VIEW ALTERNATIVE */}
      {viewMode === 'list' && (
        <div className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#262626] bg-[#181818] text-neutral-400">
                <th className="py-3 px-4 font-semibold">Fecha & Hora</th>
                <th className="py-3 px-4 font-semibold">Cliente</th>
                <th className="py-3 px-4 font-semibold">Servicio</th>
                <th className="py-3 px-4 font-semibold">Monto</th>
                <th className="py-3 px-4 font-semibold">Estado</th>
                <th className="py-3 px-4 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e]">
              {weekAppointments.map(apt => (
                <tr key={apt.id} className="hover:bg-[#181818] transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-white">
                    {apt.date} a las {apt.startTime}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-white">{apt.customerName}</div>
                    <div className="text-[11px] text-neutral-500 font-mono">{apt.customerPhone}</div>
                  </td>
                  <td className="py-3 px-4 text-neutral-300">{apt.serviceName}</td>
                  <td className="py-3 px-4 font-mono font-bold text-[var(--gold-primary)]">
                    {formatCurrency(apt.finalPrice, currency)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-300">
                      {apt.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setInspectingApt(apt)}
                      className="px-2.5 py-1 rounded bg-[#252525] hover:bg-[var(--gold-primary)] hover:text-black text-neutral-200 text-xs font-semibold"
                    >
                      Ver Detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Appointment Detail & Cobro Modal */}
      {inspectingApt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-[var(--gold-primary)]" />
                <h3 className="text-sm font-bold text-white">Ficha de Cita Agendada</h3>
              </div>
              <button onClick={() => setInspectingApt(null)} className="p-1 text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="p-3 bg-[#181818] rounded-xl border border-neutral-800 space-y-2">
                <div className="flex justify-between text-neutral-400">
                  <span>Cliente:</span>
                  <strong className="text-white text-sm">{inspectingApt.customerName}</strong>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Teléfono:</span>
                  <span className="font-mono text-neutral-200">{inspectingApt.customerPhone}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Servicio:</span>
                  <strong className="text-white">{inspectingApt.serviceName}</strong>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Fecha y Hora:</span>
                  <strong className="text-white font-mono">{inspectingApt.date} a las {inspectingApt.startTime} ({inspectingApt.durationMinutes} min)</strong>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Estado Actual:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-200 uppercase">
                    {inspectingApt.status}
                  </span>
                </div>
                {inspectingApt.notes && (
                  <div className="pt-2 border-t border-neutral-800 text-neutral-400 italic">
                    Notas: "{inspectingApt.notes}"
                  </div>
                )}
                <div className="pt-2 border-t border-neutral-700 flex justify-between items-center text-sm font-bold">
                  <span className="text-white">Importe del Corte:</span>
                  <span className="font-mono text-emerald-400">{formatCurrency(inspectingApt.finalPrice, currency)}</span>
                </div>
              </div>

              {inspectingApt.status !== 'completed' && inspectingApt.status !== 'cancelled' && (
                <div>
                  <label className="text-neutral-400 block mb-1.5 font-semibold">
                    Medio de pago para finalizar y cobrar:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'nequi', label: 'Nequi' },
                        { id: 'daviplata', label: 'Daviplata' },
                        { id: 'cash', label: 'Efectivo' },
                        { id: 'transfer', label: 'Transferencia' },
                      ] as const
                    ).map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`p-2 rounded-lg border text-left font-medium transition-colors ${
                          paymentMethod === m.id
                            ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] font-bold'
                            : 'border-neutral-800 bg-[#181818] text-neutral-300'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-[#262626] flex items-center justify-between">
              {inspectingApt.status !== 'completed' && inspectingApt.status !== 'cancelled' ? (
                <button
                  onClick={() => handleCancelAppointment(inspectingApt.id)}
                  className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  Cancelar Cita
                </button>
              ) : (
                <span className="text-xs text-neutral-500 font-mono">ID: {inspectingApt.id}</span>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInspectingApt(null)}
                  className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
                >
                  Cerrar
                </button>

                {inspectingApt.status !== 'completed' && inspectingApt.status !== 'cancelled' && (
                  <button
                    onClick={handleCompleteAppointment}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Finalizar & Cobrar</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Appointment from Grid Slot Click */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <h3 className="text-sm font-bold text-white">Agendar Cita en Agenda Semanal</h3>
              <button onClick={() => setIsNewModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="py-4 space-y-3 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Nombre del Cliente</label>
                <input
                  type="text"
                  required
                  value={formCustName}
                  onChange={e => setFormCustName(e.target.value)}
                  placeholder="Ej. Andrés Restrepo"
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Teléfono Móvil (WhatsApp)</label>
                <input
                  type="text"
                  required
                  value={formCustPhone}
                  onChange={e => setFormCustPhone(e.target.value)}
                  placeholder="+57 310 987 6543"
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Servicio de Barbería</label>
                <select
                  value={formServiceId}
                  onChange={e => setFormServiceId(e.target.value)}
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white cursor-pointer"
                >
                  {myServices.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({formatCurrency(s.price, currency)})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Día Programado</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-neutral-400 block mb-1">Hora de Inicio</label>
                  <select
                    value={formTime}
                    onChange={e => setFormTime(e.target.value)}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono cursor-pointer"
                  >
                    {gridHours.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Notas del Corte</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Ej. Fade en V, barba marcada a navaja..."
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#262626]">
                <button type="button" onClick={() => setIsNewModalOpen(false)} className="px-4 py-2 text-neutral-400">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-[var(--gold-primary)] text-black font-bold">
                  Confirmar en Agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
