import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import {
  LayoutDashboard,
  Calendar,
  Wallet,
  Scissors,
  UserCheck,
  ShoppingBag,
  User,
  QrCode,
  Star,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
  Search,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';

export const BarberoInicio: React.FC = () => {
  const { currentBarber, state, currency, navigate } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const barber = currentBarber || state.barbers.find(b => b.isIndependent) || state.barbers[0];
  const slug = barber?.slug || 'alex-fade';
  const barberId = barber?.id || 'barber-ind-1';

  // Barber appointments
  const todayDate = '2026-10-13';
  const barberAppointments = state.appointments.filter(a => a.barberId === barberId);
  const appointmentsToday = barberAppointments.filter(a => a.date === todayDate);
  const weeklyAppointments = barberAppointments.filter(a => {
    // Week of Oct 12 - Oct 18, 2026
    return a.date >= '2026-10-12' && a.date <= '2026-10-18';
  });

  const completedToday = appointmentsToday.filter(a => a.status === 'completed').length;
  const estimatedWeeklyEarnings = weeklyAppointments.reduce((acc, a) => acc + (a.finalPrice || a.price || 0) * 0.7, 0); // 70% commission / profit

  const modules = [
    {
      id: 'dashboard',
      title: 'Mi Dashboard Personal',
      desc: 'Métricas de cortes completados, porcentaje de ocupación semanal y balance de ganancias.',
      icon: LayoutDashboard,
      gradient: 'from-amber-500 to-yellow-600',
      badge: `${appointmentsToday.length} citas hoy`,
      badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
      path: `/barbero/${slug}/dashboard`,
    },
    {
      id: 'agenda',
      title: 'Mi Agenda Semanal',
      desc: 'Vista semanal interactiva completa (08:00 a 20:00). Consulta citas de lunes a domingo y abre nuevos turnos.',
      icon: Calendar,
      gradient: 'from-blue-500 to-indigo-600',
      badge: `${weeklyAppointments.length} citas semana`,
      badgeColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
      path: `/barbero/${slug}/agenda`,
    },
    {
      id: 'contabilidad',
      title: 'Mi Contabilidad & Caja',
      desc: 'Control de cobros por corte, propinas recibidas, métodos de pago (Nequi/Daviplata/Efectivo) y liquidación.',
      icon: Wallet,
      gradient: 'from-emerald-500 to-teal-600',
      badge: formatCurrency(estimatedWeeklyEarnings, currency),
      badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
      path: `/barbero/${slug}/contabilidad`,
    },
    {
      id: 'clientes',
      title: 'Mis Clientes Frecuentes',
      desc: 'Directorio de tus clientes leales, notas de estilo, fotos de referencia y preferencias de degradado.',
      icon: UserCheck,
      gradient: 'from-sky-500 to-cyan-600',
      badge: 'Clientes leales',
      badgeColor: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
      path: `/barbero/${slug}/clientes`,
    },
    {
      id: 'boutique',
      title: 'Mi Boutique & Productos',
      desc: 'Venta de productos de fijación, aceites para barba, ceras mate y control de comisiones comerciales.',
      icon: ShoppingBag,
      gradient: 'from-purple-500 to-violet-600',
      badge: 'Comisiones 15%',
      badgeColor: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
      path: `/barbero/${slug}/boutique`,
    },
    {
      id: 'servicios',
      title: 'Mis Servicios & Especialidades',
      desc: 'Configura tus cortes estrella: Mid Fade, Taper Fade, Barba Deluxe, Diseños Navaja y duraciones.',
      icon: Scissors,
      gradient: 'from-rose-500 to-pink-600',
      badge: `${state.services.length} servicios`,
      badgeColor: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
      path: `/barbero/${slug}/servicios`,
    },
    {
      id: 'perfil',
      title: 'Mi Perfil & Portafolio',
      desc: 'Tu vitrina digital como barbero: biografía, fotos de mejores degradados, enlaces a Instagram y WhatsApp.',
      icon: User,
      gradient: 'from-amber-600 to-orange-700',
      badge: '⭐ 4.9 (95 reseñas)',
      badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
      path: `/barbero/${slug}/perfil`,
    },
    {
      id: 'qr',
      title: 'Mi Código QR Personal',
      desc: 'QR exclusivo de tu silla. Comparte con tus clientes para que agenden directamente contigo en tu agenda.',
      icon: QrCode,
      gradient: 'from-teal-500 to-emerald-600',
      badge: 'QR Directo Silla',
      badgeColor: 'text-teal-400 bg-teal-400/10 border-teal-400/20',
      path: `/barbero/${slug}/qr`,
    },
  ];

  const filteredModules = modules.filter(m =>
    m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.desc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Barber Paradise Luxury Hero Banner */}
      <div className="relative overflow-hidden rounded-[28px] bg-[#141414] border border-[#242424] p-6 sm:p-8 shadow-[0_22px_54px_rgba(0,0,0,0.5)]">
        {/* Ambient Amber Glow */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#e5a700]/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative">
              <img
                src={barber?.photo}
                alt={barber?.name}
                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#e5a700] shadow-xl shrink-0"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#181818] border border-[#242424] flex items-center justify-center">
                <Scissors className="w-2.5 h-2.5 text-[#e5a700]" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1e1e1e] border border-[#2c2c2c] text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[#e5a700] font-extrabold uppercase tracking-wider text-[11px]">En Turno Activo</span>
                <span className="text-neutral-500">•</span>
                <span className="text-neutral-300 font-mono text-[11px]">{barber?.isIndependent ? 'Estudio Propio' : 'Barber Club'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-[850] uppercase tracking-[-0.8px] text-white">
                INICIO • <span className="text-[#e5a700]">{barber?.name}</span>
              </h1>
              <p className="text-xs sm:text-sm text-[#aaaaaa]">
                Tu estación digital de barbero profesional. Gestiona tu agenda semanal, clientes, servicios y caja.
              </p>
            </div>
          </div>

          {/* Quick Metrics Capsule */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-3 rounded-2xl bg-[#181818] border border-[#242424]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#aaaaaa] block">Citas Semana</span>
              <span className="text-lg font-black text-white font-mono">{weeklyAppointments.length} Programadas</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-[#181818] border border-[#242424]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#aaaaaa] block">Citas Hoy</span>
              <span className="text-lg font-black text-[#e5a700] font-mono">{appointmentsToday.length} Hoy</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-[#181818] border border-[#242424]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#aaaaaa] block">Est. Semanal</span>
              <span className="text-lg font-black text-emerald-400 font-mono">{formatCurrency(estimatedWeeklyEarnings, currency)}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions Shortcuts */}
        <div className="relative z-10 mt-6 pt-5 border-t border-[#242424] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#aaaaaa]">
            <Sparkles className="w-4 h-4 text-[#e5a700]" />
            <span className="font-semibold uppercase tracking-wider text-[11px]">Tus Accesos Directos:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate(`/barbero/${slug}/agenda`)}
              className="px-3.5 py-1.5 rounded-xl bg-[#e5a700]/15 hover:bg-[#e5a700]/25 border border-[#e5a700]/40 text-xs font-bold text-[#e5a700] transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Ver Mi Agenda Semanal</span>
            </button>
            <button
              onClick={() => navigate(`/barbero/${slug}/contabilidad`)}
              className="px-3.5 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-[#252525] border border-[#2c2c2c] text-xs font-medium text-white transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Mi Caja & Propinas</span>
            </button>
            <button
              onClick={() => navigate(`/barbero/${slug}/qr`)}
              className="px-3.5 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-[#252525] border border-[#2c2c2c] text-xs font-medium text-white transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Mi QR Personal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modules Finder */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Mis Herramientas & Módulos</span>
            <span className="text-xs font-normal text-neutral-400 font-mono bg-white/[0.06] px-2 py-0.5 rounded-full border border-white/[0.08]">
              {modules.length} módulos
            </span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Selecciona cualquier módulo para gestionar tus citas, ingresos y portafolio de cortes
          </p>
        </div>

        {/* Search bar */}
        <div className="relative sm:w-64">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar herramienta..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-neutral-500 focus:outline-none focus:border-[var(--gold-primary)] transition-all"
          />
        </div>
      </div>

      {/* Grid of Barber Paradise Luxury Module Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredModules.map(module => {
          const Icon = module.icon;
          return (
            <div
              key={module.id}
              onClick={() => navigate(module.path)}
              className="group relative overflow-hidden rounded-[24px] bp-card p-6 cursor-pointer flex flex-col justify-between"
            >
              {/* Top specular highlight line */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#e5a700]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#222222] border border-[#2c2c2c] flex items-center justify-center text-[#e5a700] shrink-0 group-hover:scale-105 group-hover:border-[#e5a700]/50 transition-all duration-300">
                    <Icon className="w-5 h-5" strokeWidth={1.8} />
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border font-mono ${module.badgeColor}`}>
                    {module.badge}
                  </span>
                </div>

                <h3 className="text-base font-[850] uppercase tracking-[-0.5px] text-[#f6f6f6] group-hover:text-[#e5a700] transition-colors">
                  {module.title}
                </h3>
                <p className="text-xs text-[#aaaaaa] mt-2 leading-relaxed">
                  {module.desc}
                </p>
              </div>

              {/* Card Footer / Action Link */}
              <div className="mt-6 pt-4 border-t border-[#242424] flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#aaaaaa] group-hover:text-white transition-colors">
                  Abrir herramienta
                </span>
                <div className="w-8 h-8 rounded-full bg-[#222222] border border-[#2a2a2a] flex items-center justify-center text-neutral-300 group-hover:text-black group-hover:bg-[#e5a700] group-hover:border-[#e5a700] transition-all duration-300">
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
