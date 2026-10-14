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
      {/* Barber Paradise Luxury Hero Banner */}
      <div className="relative overflow-hidden rounded-[28px] bg-[#141414] border border-[#242424] p-6 sm:p-8 shadow-[0_22px_54px_rgba(0,0,0,0.5)]">
        {/* Ambient Amber Glow */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#e5a700]/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative">
              <img
                src={currentShop?.logo}
                alt={currentShop?.name}
                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#e5a700] shadow-xl shrink-0"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#181818] border border-[#242424] flex items-center justify-center">
                <Scissors className="w-2.5 h-2.5 text-[#e5a700]" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1e1e1e] border border-[#2c2c2c] text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[#e5a700] font-extrabold uppercase tracking-wider text-[11px]">Sede Abierta</span>
                <span className="text-neutral-500">•</span>
                <span className="text-neutral-300 font-mono text-[11px]">{currentShop?.city}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-[850] uppercase tracking-[-0.8px] text-white">
                INICIO <span className="text-[#e5a700]">{currentShop?.name}</span>
              </h1>
              <p className="text-xs sm:text-sm text-[#aaaaaa]">
                Panel central para gestión de citas, barberos, caja y servicios. Todos los módulos a un clic.
              </p>
            </div>
          </div>

          {/* Quick Metrics Capsule */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-3 rounded-2xl bg-[#181818] border border-[#242424]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#aaaaaa] block">Caja del Día</span>
              <span className="text-lg font-black text-emerald-400 font-mono">{formatCurrency(todayIncome, currency)}</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-[#181818] border border-[#242424]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#aaaaaa] block">Citas Hoy</span>
              <span className="text-lg font-black text-white font-mono">{shopAppointmentsToday.length} Total</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-[#181818] border border-[#242424]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#aaaaaa] block">En Espera</span>
              <span className="text-lg font-black text-[#e5a700] font-mono">{waitingWalkIns} Turnos</span>
            </div>
          </div>
        </div>

        {/* Quick Actions Shortcuts */}
        <div className="relative z-10 mt-6 pt-5 border-t border-[#242424] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#aaaaaa]">
            <Sparkles className="w-4 h-4 text-[#e5a700]" />
            <span className="font-semibold uppercase tracking-wider text-[11px]">Accesos Rápidos:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate(`/barberia/${slug}/agenda`)}
              className="px-3.5 py-1.5 rounded-xl bg-[#e5a700]/15 hover:bg-[#e5a700]/25 border border-[#e5a700]/40 text-xs font-bold text-[#e5a700] transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Ver Agenda Semanal</span>
            </button>
            <button
              onClick={() => navigate(`/barberia/${slug}/contabilidad`)}
              className="px-3.5 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-[#252525] border border-[#2c2c2c] text-xs font-medium text-white transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Caja & Liquidación</span>
            </button>
            <button
              onClick={() => navigate(`/barberia/${slug}/qr`)}
              className="px-3.5 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-[#252525] border border-[#2c2c2c] text-xs font-medium text-white transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
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
          <h2 className="text-xl font-[850] uppercase tracking-tight text-white flex items-center gap-2">
            <span>Módulos de la Barbería</span>
            <span className="text-[11px] font-mono text-[#e5a700] bg-[#1e1e1e] px-2.5 py-0.5 rounded-full border border-[#2a2a2a]">
              {modules.length} MÓDULOS
            </span>
          </h2>
          <p className="text-xs text-[#aaaaaa] mt-0.5">
            Explora las herramientas para administrar operaciones, finanzas y clientes
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
              className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-[#141414] border border-[#242424] text-white placeholder-neutral-500 focus:outline-none focus:border-[#e5a700] transition-all"
            />
          </div>

          {/* Filter Pills with BP style */}
          <div className="flex items-center bg-[#141414] p-1 rounded-2xl border border-[#242424]">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 text-xs font-bold uppercase transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bp-pill-active'
                  : 'text-[#aaaaaa] hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setSelectedCategory('operaciones')}
              className={`px-3 py-1.5 text-xs font-bold uppercase transition-all cursor-pointer ${
                selectedCategory === 'operaciones'
                  ? 'bp-pill-active'
                  : 'text-[#aaaaaa] hover:text-white'
              }`}
            >
              Operaciones
            </button>
            <button
              onClick={() => setSelectedCategory('gestion')}
              className={`px-3 py-1.5 text-xs font-bold uppercase transition-all cursor-pointer ${
                selectedCategory === 'gestion'
                  ? 'bp-pill-active'
                  : 'text-[#aaaaaa] hover:text-white'
              }`}
            >
              Gestión
            </button>
            <button
              onClick={() => setSelectedCategory('comercial')}
              className={`px-3 py-1.5 text-xs font-bold uppercase transition-all cursor-pointer ${
                selectedCategory === 'comercial'
                  ? 'bp-pill-active'
                  : 'text-[#aaaaaa] hover:text-white'
              }`}
            >
              Comercial
            </button>
          </div>
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
              {/* Subtle top amber highlight */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#e5a700]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  {/* Round Luxury Icon Container like in Barber Paradise */}
                  <div className="w-12 h-12 rounded-full bg-[#222222] border border-[#2c2c2c] flex items-center justify-center text-[#e5a700] shrink-0 group-hover:scale-105 group-hover:border-[#e5a700]/50 transition-all duration-300">
                    <Icon className="w-5 h-5" strokeWidth={1.8} />
                  </div>

                  {/* Dynamic Badge */}
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
                  Acceder al Módulo
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
