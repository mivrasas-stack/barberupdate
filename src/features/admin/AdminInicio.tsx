import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import {
  LayoutDashboard,
  Users,
  Store,
  CreditCard,
  Layers,
  Globe,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Activity,
  ShieldCheck,
  Zap,
  Search,
  Sparkles,
  ExternalLink,
  Sliders,
} from 'lucide-react';

export const AdminInicio: React.FC = () => {
  const { state, currency, navigate, currentUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'platform' | 'commercial' | 'security'>('all');

  const totalShops = state.barbershops.length;
  const totalUsers = state.users.length;
  const activeSubs = state.barbershops.filter(s => s.subscriptionStatus === 'active').length;
  const totalMRR = state.barbershops
    .filter(s => s.subscriptionStatus === 'active')
    .reduce((acc, s) => {
      const plan = state.plans.find(p => p.id === s.planId);
      return acc + (plan?.monthlyPrice || 149000);
    }, 0);

  const modules = [
    {
      id: 'dashboard',
      title: 'Dashboard Global',
      category: 'platform',
      desc: 'Métricas en tiempo real, volumen de transacciones de la red y salud del ecosistema.',
      icon: LayoutDashboard,
      gradient: 'from-amber-500 to-yellow-600',
      badge: `${totalShops} sedes activas`,
      badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
      path: '/admin/dashboard',
    },
    {
      id: 'usuarios',
      title: 'Gestión de Usuarios',
      category: 'platform',
      desc: 'Directorio maestro de clientes, barberos asociados, administradores y control de roles.',
      icon: Users,
      gradient: 'from-blue-500 to-indigo-600',
      badge: `${totalUsers} cuentas`,
      badgeColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
      path: '/admin/usuarios',
    },
    {
      id: 'franquicias',
      title: 'Franquicias & Barberías',
      category: 'platform',
      desc: 'Supervisión de sedes comerciales, datos de contacto, suscripción asociada y configuración multi-sede.',
      icon: Store,
      gradient: 'from-emerald-500 to-teal-600',
      badge: `${totalShops} barberías`,
      badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
      path: '/admin/franquicias',
    },
    {
      id: 'suscripciones',
      title: 'Suscripciones SaaS',
      category: 'commercial',
      desc: 'Facturación recurrente mensual/anual, estado de pagos y cobro automatizado a barberías.',
      icon: CreditCard,
      gradient: 'from-purple-500 to-violet-600',
      badge: `${activeSubs} activas`,
      badgeColor: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
      path: '/admin/suscripciones',
    },
    {
      id: 'planes',
      title: 'Planes Comerciales',
      category: 'commercial',
      desc: 'Configuración de paquetes tarifarios, límites de barberos por local, comisiones y funciones exclusivas.',
      icon: Layers,
      gradient: 'from-rose-500 to-pink-600',
      badge: `${state.plans.length} planes`,
      badgeColor: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
      path: '/admin/planes',
    },
    {
      id: 'editor-comercial',
      title: 'Editor Página Comercial',
      category: 'commercial',
      desc: 'Control del portal público de ventas, banner de precios en vivo, testimonios y landing conversion.',
      icon: Globe,
      gradient: 'from-cyan-500 to-blue-600',
      badge: 'Pública v2.4',
      badgeColor: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
      path: '/admin/editor-comercial',
    },
    {
      id: 'administradores',
      title: 'Administradores & Seguridad',
      category: 'security',
      desc: 'Gestión del equipo de soporte global, claves maestras, logs de actividad y políticas de acceso.',
      icon: ShieldAlert,
      gradient: 'from-orange-500 to-amber-600',
      badge: 'Nivel 1 Root',
      badgeColor: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
      path: '/admin/administradores',
    },
  ];

  const filteredModules = modules.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          m.desc.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'all' || m.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Barber Paradise Luxury Superadmin Hero Banner */}
      <div className="relative overflow-hidden rounded-[28px] bg-[#141414] border border-[#242424] p-6 sm:p-8 shadow-[0_22px_54px_rgba(0,0,0,0.5)]">
        {/* Ambient Amber Glow */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#e5a700]/12 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1e1e1e] border border-[#2c2c2c] text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[#e5a700] font-extrabold uppercase tracking-wider text-[11px]">Plataforma Maestro Global • BarberOS</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-[850] uppercase tracking-[-0.9px] text-white">
              INICIO <span className="text-[#e5a700]">SUPERADMIN</span>
            </h1>
            <p className="text-sm text-[#aaaaaa] max-w-xl">
              Bienvenido, <strong className="text-white">{currentUser?.name || 'Carlos Mendoza'}</strong>. Control centralizado de toda la red de barberías, usuarios, suscripciones y facturación global.
            </p>
          </div>

          {/* Quick Metrics Capsule */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-3 rounded-2xl bg-[#181818] border border-[#242424]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#aaaaaa] block">MRR Mensual</span>
              <span className="text-lg font-black text-white font-mono">{formatCurrency(totalMRR, currency)}</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-[#181818] border border-[#242424]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#aaaaaa] block">Barberías</span>
              <span className="text-lg font-black text-[#e5a700] font-mono">{totalShops} Activas</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-[#181818] border border-[#242424]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#aaaaaa] block">Usuarios</span>
              <span className="text-lg font-black text-emerald-400 font-mono">{totalUsers} Cuentas</span>
            </div>
          </div>
        </div>

        {/* Quick Actions Strip */}
        <div className="relative z-10 mt-6 pt-5 border-t border-[#242424] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#aaaaaa]">
            <Sparkles className="w-4 h-4 text-[#e5a700]" />
            <span className="font-semibold uppercase tracking-wider text-[11px]">Acciones Rápidas del Sistema:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/admin/usuarios')}
              className="px-3.5 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-[#252525] border border-[#2c2c2c] text-xs font-semibold text-white transition-all cursor-pointer active:scale-95"
            >
              + Nuevo Usuario
            </button>
            <button
              onClick={() => navigate('/admin/franquicias')}
              className="px-3.5 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-[#252525] border border-[#2c2c2c] text-xs font-semibold text-white transition-all cursor-pointer active:scale-95"
            >
              + Nueva Franquicia
            </button>
            <button
              onClick={() => navigate('/admin/suscripciones')}
              className="px-3.5 py-1.5 rounded-xl bg-[#e5a700]/15 hover:bg-[#e5a700]/25 border border-[#e5a700]/40 text-xs font-bold text-[#e5a700] transition-all cursor-pointer active:scale-95"
            >
              Ver Facturación
            </button>
          </div>
        </div>
      </div>

      {/* Module Finder & Category Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Módulos de la Plataforma</span>
            <span className="text-xs font-normal text-neutral-400 font-mono bg-white/[0.06] px-2 py-0.5 rounded-full border border-white/[0.08]">
              {modules.length} disponibles
            </span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Selecciona cualquier módulo para acceder a sus herramientas operativas
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar módulo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-neutral-500 focus:outline-none focus:border-[var(--gold-primary)] transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/[0.08]">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setActiveCategory('platform')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                activeCategory === 'platform'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Operación
            </button>
            <button
              onClick={() => setActiveCategory('commercial')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                activeCategory === 'commercial'
                  ? 'bg-white/[0.12] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
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
                  Abrir módulo
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
