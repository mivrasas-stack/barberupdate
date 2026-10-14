import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import {
  LayoutDashboard,
  Calendar,
  Wallet,
  Scissors,
  Users,
  UserCheck,
  ShoppingBag,
  Store,
  QrCode,
  Star,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
  Search,
  PlusCircle,
  Coffee,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const BarberiaInicio: React.FC = () => {
  const { currentShop, state, currency, navigate } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'operaciones' | 'comercial' | 'gestion'>('all');

  const slug = currentShop?.slug || 'barber-club';
  const shopId = currentShop?.id || 'shop-1';

  // Stats for today (2026-10-13)
  const todayDate = '2026-10-13';
  const shopBarbers = state.barbers.filter(b => b.businessId === shopId);
  const shopAppointmentsToday = state.appointments.filter(
    a => a.businessId === shopId && a.date === todayDate
  );
  const waitingWalkIns = shopAppointmentsToday.filter(a => a.status === 'waiting' || a.status === 'in_service').length;
  const completedToday = shopAppointmentsToday.filter(a => a.status === 'completed').length;

  const todayIncome = state.transactions
    .filter(t => t.businessId === shopId && t.date.startsWith(todayDate) && t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const lowStockCount = state.products.filter(
    p => p.businessId === shopId && p.stock <= p.minStock
  ).length;

  const modules = [
    {
      id: 'dashboard',
      title: 'Dashboard Operativo',
      category: 'operaciones',
      desc: 'Métricas del día en vivo: ocupación, ingresos proyectados, estado de caja y flujo de clientes.',
      icon: LayoutDashboard,
      gradient: 'from-amber-500 to-yellow-600',
      badge: `${shopAppointmentsToday.length} citas hoy`,
      badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
      path: `/barberia/${slug}/dashboard`,
    },
    {
      id: 'agenda',
      title: 'Agenda & Citas Semanales',
      category: 'operaciones',
      desc: 'Vista semanal interactiva de 7 días, turnos por barbero, citas confirmadas y reservas al instante.',
      icon: Calendar,
      gradient: 'from-blue-500 to-indigo-600',
      badge: 'Semana completa',
      badgeColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
      path: `/barberia/${slug}/agenda`,
    },
    {
      id: 'contabilidad',
      title: 'Contabilidad, Caja & Finanzas',
      category: 'gestion',
      desc: 'Arqueo de caja diaria, liquidación de comisiones a barberos, pagos en Nequi/Daviplata y egresos.',
      icon: Wallet,
      gradient: 'from-emerald-500 to-teal-600',
      badge: formatCurrency(todayIncome, currency),
      badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
      path: `/barberia/${slug}/contabilidad`,
    },
    {
      id: 'barberos',
      title: 'Barberos & Equipo',
      category: 'operaciones',
      desc: 'Gestión del staff, asignación de sillas, porcentaje de comisiones y control de asistencia.',
      icon: Scissors,
      gradient: 'from-orange-500 to-amber-600',
      badge: `${shopBarbers.length} barberos activos`,
      badgeColor: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
      path: `/barberia/${slug}/barberos`,
    },
    {
      id: 'clientes',
      title: 'Clientes Registrados',
      category: 'gestion',
      desc: 'Base de datos de clientes vinculados, fidelización, historial de cortes y preferencias personales.',
      icon: UserCheck,
      gradient: 'from-sky-500 to-cyan-600',
      badge: `${state.users.filter(u => u.role === 'client').length} registrados`,
      badgeColor: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
      path: `/barberia/${slug}/clientes`,
    },
    {
      id: 'boutique',
      title: 'Boutique & Inventario',
      category: 'comercial',
      desc: 'Catálogo de ceras, pomadas, aceites, control de stock mínimo y registro de ventas de mostrador.',
      icon: ShoppingBag,
      gradient: 'from-purple-500 to-violet-600',
      badge: lowStockCount > 0 ? `${lowStockCount} bajo stock` : 'Stock al día',
      badgeColor: lowStockCount > 0 ? 'text-rose-400 bg-rose-400/10 border-rose-400/20' : 'text-purple-400 bg-purple-400/10 border-purple-400/20',
      path: `/barberia/${slug}/boutique`,
    },
    {
      id: 'servicios',
      title: 'Servicios & Tarifas',
      category: 'comercial',
      desc: 'Configuración de catálogo oficial: cortes clásicos, degradados, diseño de barba, combos y duraciones.',
      icon: Users,
      gradient: 'from-pink-500 to-rose-600',
      badge: `${state.services.filter(s => s.businessId === shopId).length} servicios`,
      badgeColor: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
      path: `/barberia/${slug}/servicios`,
    },
    {
      id: 'perfil',
      title: 'Perfil Comercial & Vitrina',
      category: 'comercial',
      desc: 'Página pública de la barbería, fotos de portada, horarios de atención, ubicación y enlace para compartir.',
      icon: Store,
      gradient: 'from-amber-600 to-orange-700',
      badge: 'Perfil Público Activo',
      badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
      path: `/barberia/${slug}/perfil`,
    },
    {
      id: 'qr',
      title: 'Código QR de Vinculación',
      category: 'operaciones',
      desc: 'QR imprimible para mostrador y vitrina. Permite a los clientes auto-vincularse y pedir turno en 3 segundos.',
      icon: QrCode,
      gradient: 'from-teal-500 to-emerald-600',
      badge: 'Stand Mostrador',
      badgeColor: 'text-teal-400 bg-teal-400/10 border-teal-400/20',
      path: `/barberia/${slug}/qr`,
    },
    {
      id: 'resenas',
      title: 'Reseñas & Calificaciones',
      category: 'gestion',
      desc: 'Monitoreo de valoraciones con estrellas, opiniones de clientes tras el corte y reputación online.',
      icon: Star,
      gradient: 'from-yellow-400 to-amber-500',
      badge: '⭐ 4.9 (128 reseñas)',
      badgeColor: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
      path: `/barberia/${slug}/resenas`,
    },
    {
      id: 'reportes',
      title: 'Reportes Financieros',
      category: 'gestion',
      desc: 'Informes detallados por fecha, rendimiento por barbero, balance de pérdidas y ganancias, exportación a Excel.',
      icon: FileSpreadsheet,
      gradient: 'from-indigo-500 to-blue-700',
      badge: 'Balance Mensual',
      badgeColor: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
      path: `/barberia/${slug}/reportes`,
    },
  ];

  const filteredModules = modules.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          m.desc.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'all' || m.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Apple-style Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#18181c]/90 via-[#121215]/80 to-[#0d0d10]/95 border border-white/[0.08] p-6 sm:p-8 backdrop-blur-2xl shadow-[0_16px_50px_rgba(0,0,0,0.5)]">
        {/* Ambient Color Glows */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[var(--gold-primary)]/12 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <img
              src={currentShop?.logo}
              alt={currentShop?.name}
              className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[var(--gold-primary)]/80 shadow-xl shrink-0"
            />
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-xs font-semibold text-neutral-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[var(--gold-primary)] font-bold">Barbería Abierta</span>
                <span className="text-neutral-500">•</span>
                <span className="text-neutral-300 font-mono">{currentShop?.city}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Inicio {currentShop?.name}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400">
                Panel central para gestión de citas, barberos, caja y servicios. Todos los módulos a un clic.
              </p>
            </div>
          </div>

          {/* Quick Metrics Capsule */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">Caja del Día</span>
              <span className="text-lg font-black text-emerald-400 font-mono">{formatCurrency(todayIncome, currency)}</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">Citas Hoy</span>
              <span className="text-lg font-black text-white font-mono">{shopAppointmentsToday.length} Total</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">En Espera</span>
              <span className="text-lg font-black text-amber-400 font-mono">{waitingWalkIns} Turnos</span>
            </div>
          </div>
        </div>

        {/* Quick Actions Shortcuts */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <Sparkles className="w-4 h-4 text-[var(--gold-primary)]" />
            <span>Accesos Rápidos de Hoy:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate(`/barberia/${slug}/agenda`)}
              className="px-3 py-1.5 rounded-xl bg-[var(--gold-primary)]/15 hover:bg-[var(--gold-primary)]/25 border border-[var(--gold-primary)]/30 text-xs font-semibold text-[var(--gold-primary)] transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Ver Agenda Semanal</span>
            </button>
            <button
              onClick={() => navigate(`/barberia/${slug}/contabilidad`)}
              className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-white transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Caja & Liquidación</span>
            </button>
            <button
              onClick={() => navigate(`/barberia/${slug}/qr`)}
              className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-white transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Stand QR Clientes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modules Section Header & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Módulos de la Barbería</span>
            <span className="text-xs font-normal text-neutral-400 font-mono bg-white/[0.06] px-2 py-0.5 rounded-full border border-white/[0.08]">
              {modules.length} módulos
            </span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Explora las herramientas para administrar las operaciones, finanzas y clientes de tu negocio
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar herramienta..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-neutral-500 focus:outline-none focus:border-[var(--gold-primary)] transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/[0.08]">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setSelectedCategory('operaciones')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                selectedCategory === 'operaciones'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Operaciones
            </button>
            <button
              onClick={() => setSelectedCategory('gestion')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                selectedCategory === 'gestion'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Gestión
            </button>
            <button
              onClick={() => setSelectedCategory('comercial')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                selectedCategory === 'comercial'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Comercial
            </button>
          </div>
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
              {/* Subtle top reflection line */}
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
