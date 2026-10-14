import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  ArrowRight,
  UserPlus,
  Star,
  Scissors,
  ShoppingBag,
} from 'lucide-react';

export const BarberiaDashboard: React.FC = () => {
  const { currentShop, state, currency, navigate } = useApp();
  const [selectedBarberId, setSelectedBarberId] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toLocaleDateString('en-CA',{timeZone:'America/Bogota'}));

  const shopId = currentShop?.id || 'shop-1';
  const barbers = state.barbers.filter(b => b.businessId === shopId);

  // Filter appointments for this shop and date
  const shopAppointments = state.appointments.filter(a => {
    const matchesShop = a.businessId === shopId;
    const matchesDate = a.date === selectedDate;
    const matchesBarber = selectedBarberId === 'all' || a.barberId === selectedBarberId;
    return matchesShop && matchesDate && matchesBarber;
  });

  const totalAppointmentsToday = shopAppointments.length;
  const pendingAppointments = shopAppointments.filter(a => a.status === 'pending' || a.status === 'confirmed').length;
  const completedAppointments = shopAppointments.filter(a => a.status === 'completed').length;
  const waitingAppointments = shopAppointments.filter(a => a.status === 'waiting' || a.status === 'in_service').length;

  // Transactions of today
  const todayTransactions = state.transactions.filter(t => {
    const isToday = t.date.startsWith(selectedDate);
    const matchesShop = t.businessId === shopId;
    const matchesBarber = selectedBarberId === 'all' || !t.barberId || t.barberId === selectedBarberId;
    return matchesShop && isToday && matchesBarber;
  });

  const todayIncome = todayTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const todayExpenses = todayTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const estimatedProfit = todayIncome - todayExpenses;

  // Low stock products
  const lowStockProducts = state.products.filter(
    p => p.businessId === shopId && p.stock <= p.minStock
  );

  // Occupancy rate calculation (assuming 10 working hours * 60 min = 600 min per barber)
  const totalOccupiedMinutes = shopAppointments
    .filter(a => a.status !== 'cancelled')
    .reduce((acc, a) => acc + a.durationMinutes, 0);
  const totalAvailableMinutes = (barbers.length || 1) * 600;
  const occupancyPercentage = Math.min(100, Math.round((totalOccupiedMinutes / totalAvailableMinutes) * 100));

  return (
    <div className="space-y-6">
      {/* Header and Context Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Operaciones del Día
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Dashboard de Barbería</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Resumen en vivo de citas, ocupación, finanzas y sala de espera para {currentShop?.name}
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-3.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-[var(--gold-primary)] transition-all shadow-inner"
          />

          <select
            value={selectedBarberId}
            onChange={e => setSelectedBarberId(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-3.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-[var(--gold-primary)] cursor-pointer transition-all shadow-inner"
          >
            <option value="all" className="bg-[#18181b] text-white">Todos los barberos</option>
            {barbers.map(b => (
              <option key={b.id} value={b.id} className="bg-[#18181b] text-white">{b.name}</option>
            ))}
          </select>

          <button
            onClick={() => navigate(`/barberia/${currentShop?.slug || 'barber-club'}/agenda`)}
            className="px-4 py-2 rounded-2xl apple-button-gold text-black text-xs font-extrabold flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Registrar Llegada</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ingresos Hoy */}
        <div className="p-5 rounded-3xl apple-glass-card">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-semibold">Ingresos Brutos Hoy</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-[var(--gold-primary)]">
            {formatCurrency(todayIncome, currency)}
          </div>
          <div className="mt-2 text-[11px] text-neutral-400 flex items-center justify-between font-medium">
            <span>Ganancia neta estimada:</span>
            <span className="font-mono text-emerald-400 font-bold">{formatCurrency(estimatedProfit, currency)}</span>
          </div>
        </div>

        {/* Citas del Día */}
        <div className="p-5 rounded-3xl apple-glass-card">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-semibold">Citas Programadas</span>
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-white">
            {totalAppointmentsToday} <span className="text-xs font-normal text-neutral-400 font-sans">servicios</span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-400 flex items-center justify-between font-medium">
            <span>{completedAppointments} finalizadas</span>
            <span>·</span>
            <span>{pendingAppointments} pendientes</span>
          </div>
        </div>

        {/* En Sala de Espera / Walk-ins */}
        <div className="p-5 rounded-3xl apple-glass-card">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-semibold">Clientes en Sala / Silla</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-amber-300">
            {waitingAppointments} <span className="text-xs font-normal text-neutral-400 font-sans">turnos activos</span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-400 flex items-center justify-between font-medium">
            <span>Llegadas sin reserva:</span>
            <span className="font-mono text-neutral-200 font-bold">
              {shopAppointments.filter(a => a.isWalkIn).length} atendidos
            </span>
          </div>
        </div>

        {/* Ocupación de la Agenda */}
        <div className="p-5 rounded-3xl apple-glass-card">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-semibold">Ocupación de Agenda</span>
            <Clock className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-white">
            {occupancyPercentage}%
          </div>
          {/* Progress bar */}
          <div className="w-full bg-black/40 border border-white/[0.06] h-2 rounded-full mt-3 overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-[var(--gold-primary)] to-amber-300 h-full rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${occupancyPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Two Column Layout: Upcoming Appointments & Boutique/Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Agenda Timeline for Today */}
        <div className="lg:col-span-7 bg-[#141414] border border-[#262626] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white">Próximas Citas y Turnos en Curso</h2>
              <p className="text-[11px] text-neutral-400">Secuencia de atención para la fecha seleccionada</p>
            </div>
            <button
              onClick={() => navigate(`/barberia/${currentShop?.slug || 'barber-club'}/agenda`)}
              className="text-xs text-[var(--gold-primary)] hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Ver Agenda Completa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {shopAppointments.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-500">
                No hay citas programadas para esta fecha o filtro.
              </div>
            ) : (
              shopAppointments.map(apt => {
                const barber = state.barbers.find(b => b.id === apt.barberId);
                let statusBadge = (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
                    {apt.status}
                  </span>
                );
                if (apt.status === 'completed') {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Finalizado
                    </span>
                  );
                } else if (apt.status === 'in_service') {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border border-[var(--gold-primary)]/40 animate-pulse">
                      En Silla
                    </span>
                  );
                } else if (apt.status === 'waiting') {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      En Sala de Espera
                    </span>
                  );
                } else if (apt.status === 'confirmed') {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      Confirmada
                    </span>
                  );
                }

                return (
                  <div
                    key={apt.id}
                    className="p-3 bg-[#181818] rounded-xl border border-[#282828] flex items-center justify-between text-xs hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="font-mono font-bold text-white text-sm bg-neutral-900 px-2 py-1.5 rounded-lg border border-neutral-800 text-center min-w-[58px]">
                        {apt.startTime}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{apt.customerName}</span>
                          {apt.isWalkIn && (
                            <span className="text-[10px] text-amber-400 font-semibold px-1 rounded bg-amber-500/10">
                              Walk-in
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-400 mt-0.5">
                          {apt.serviceName} · <span className="text-neutral-300">{barber?.name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-3">
                      <div className="hidden sm:block">
                        <div className="font-mono font-bold text-white">{formatCurrency(apt.finalPrice, currency)}</div>
                        <div className="text-[10px] text-neutral-500">{apt.durationMinutes} min</div>
                      </div>
                      {statusBadge}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Inventory Stock Alerts & Quick Boutique */}
        <div className="lg:col-span-5 space-y-6">
          {/* Low Stock Alert Box */}
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white">Alertas de Bajo Stock</h2>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                {lowStockProducts.length} productos
              </span>
            </div>

            <p className="text-xs text-neutral-400 mb-3">
              Productos que han alcanzado o superado el umbral mínimo de reposición:
            </p>

            <div className="space-y-2">
              {lowStockProducts.length === 0 ? (
                <div className="py-4 text-center text-xs text-emerald-400 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Todos los niveles de inventario están saludables.</span>
                </div>
              ) : (
                lowStockProducts.map(prod => (
                  <div
                    key={prod.id}
                    className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">{prod.name}</div>
                      <div className="text-[10px] text-neutral-500 font-mono">SKU: {prod.sku}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-amber-400 font-bold font-mono text-sm">{prod.stock}</span>
                      <span className="text-neutral-500 text-[11px]"> / mín. {prod.minStock}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-800">
              <button
                onClick={() => navigate(`/barberia/${currentShop?.slug || 'barber-club'}/boutique`)}
                className="w-full py-2 rounded-xl bg-[#202020] hover:bg-[#282828] text-xs font-semibold text-white transition-colors text-center"
              >
                Gestionar Boutique e Inventario
              </button>
            </div>
          </div>

          {/* Quick Team Status */}
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white mb-3">Equipo en Servicio</h2>
            <div className="space-y-2.5">
              {barbers.map(barber => {
                const cutsDone = shopAppointments.filter(a => a.barberId === barber.id && a.status === 'completed').length;
                return (
                  <div key={barber.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#181818] border border-neutral-800 text-xs">
                    <div className="flex items-center gap-2.5">
                      <img src={barber.photo} alt={barber.name} className="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <div className="font-bold text-white">{barber.name}</div>
                        <div className="text-[10px] text-neutral-400">Horario: {barber.workHours.start} - {barber.workHours.end}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-[var(--gold-primary)]">{cutsDone} cortes</span>
                      <div className="text-[10px] text-neutral-500">hoy</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
