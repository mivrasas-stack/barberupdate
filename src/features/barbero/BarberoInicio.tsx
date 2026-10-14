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
      {/* Apple-style Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#18181c]/90 via-[#121215]/80 to-[#0d0d10]/95 border border-white/[0.08] p-6 sm:p-8 backdrop-blur-2xl shadow-[0_16px_50px_rgba(0,0,0,0.5)]">
        {/* Ambient Color Glows */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[var(--gold-primary)]/12 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <img
              src={barber?.photo}
              alt={barber?.name}
              className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[var(--gold-primary)]/80 shadow-xl shrink-0"
            />
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-xs font-semibold text-neutral-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[var(--gold-primary)] font-bold">En Turno Activo</span>
                <span className="text-neutral-500">•</span>
                <span className="text-neutral-300">{barber?.isIndependent ? 'Estudio Propio' : 'Barber Club'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Inicio • {barber?.name}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400">
                Tu estación digital de barbero profesional. Gestiona tu agenda semanal, clientes, servicios y caja.
              </p>
            </div>
          </div>

          {/* Quick Metrics Capsule */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">Citas Semana</span>
              <span className="text-lg font-black text-white font-mono">{weeklyAppointments.length} Programadas</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">Citas Hoy</span>
              <span className="text-lg font-black text-[var(--gold-primary)] font-mono">{appointmentsToday.length} Hoy</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">Est. Semanal</span>
              <span className="text-lg font-black text-emerald-400 font-mono">{formatCurrency(estimatedWeeklyEarnings, currency)}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions Shortcuts */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <Sparkles className="w-4 h-4 text-[var(--gold-primary)]" />
            <span>Tus Accesos Directos:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate(`/barbero/${slug}/agenda`)}
              className="px-3.5 py-1.5 rounded-xl bg-[var(--gold-primary)]/15 hover:bg-[var(--gold-primary)]/25 border border-[var(--gold-primary)]/30 text-xs font-semibold text-[var(--gold-primary)] transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Ver Mi Agenda Semanal</span>
            </button>
            <button
              onClick={() => navigate(`/barbero/${slug}/contabilidad`)}
              className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-white transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Mi Caja & Propinas</span>
            </button>
            <button
              onClick={() => navigate(`/barbero/${slug}/qr`)}
              className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-white transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
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

      {/* Grid of Apple-style Module Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredModules.map(module => {
          const Icon = module.icon;
          return (
            <div
              key={module.id}
              onClick={() => navigate(module.path)}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] hover:border-[var(--gold-primary)]/40 p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.6),0_0_24px_rgba(217,163,35,0.12)] cursor-pointer flex flex-col justify-between"
            >
              {/* Top specular highlight line */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  {/* Apple Squircle Icon */}
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${module.gradient} p-0.5 shadow-lg flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                    <div className="w-full h-full rounded-[14px] bg-black/20 backdrop-blur-sm flex items-center justify-center">
                      <Icon className="w-6 h-6 drop-shadow-sm" />
                    </div>
                  </div>

                  {/* Dynamic Badge */}
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border font-mono ${module.badgeColor}`}>
                    {module.badge}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-[var(--gold-primary)] transition-colors">
                  {module.title}
                </h3>
                <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                  {module.desc}
                </p>
              </div>

              {/* Card Footer / Action Link */}
              <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400 group-hover:text-white transition-colors">
                  Abrir módulo
                </span>
                <div className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-neutral-300 group-hover:text-black group-hover:bg-[var(--gold-primary)] group-hover:border-[var(--gold-primary)] transition-all duration-300">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
