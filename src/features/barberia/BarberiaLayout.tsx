import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Home,
  LayoutDashboard,
  Calendar,
  Wallet,
  Users,
  UserCheck,
  ShoppingBag,
  Scissors,
  Store,
  Star,
  FileSpreadsheet,
  QrCode,
  Menu,
  X,
  ChevronRight,
  UserPlus,
} from 'lucide-react';

export const BarberiaLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentShop, activeRoute, navigate, state } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const slug = currentShop?.slug || 'barber-club';
  const isInicio = activeRoute === `/barberia/${slug}/inicio` || activeRoute === `/barberia/${slug}` || activeRoute === `/barberia/${slug}/`;

  const menuItems = [
    { label: '← Volver al Inicio', path: `/barberia/${slug}/inicio`, icon: <Home className="w-4 h-4 text-[var(--gold-primary)]" /> },
    { label: 'Dashboard', path: `/barberia/${slug}/dashboard`, icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: 'Agenda & Citas', path: `/barberia/${slug}/agenda`, icon: <Calendar className="w-4 h-4" /> },
    { label: 'Contabilidad & Caja', path: `/barberia/${slug}/contabilidad`, icon: <Wallet className="w-4 h-4" /> },
    { label: 'Barberos & Equipo', path: `/barberia/${slug}/barberos`, icon: <Scissors className="w-4 h-4" /> },
    { label: 'Clientes Registrados', path: `/barberia/${slug}/clientes`, icon: <UserCheck className="w-4 h-4" /> },
    { label: 'Boutique & Inventario', path: `/barberia/${slug}/boutique`, icon: <ShoppingBag className="w-4 h-4" /> },
    { label: 'Servicios & Tarifas', path: `/barberia/${slug}/servicios`, icon: <Users className="w-4 h-4" /> },
    { label: 'Perfil Comercial & Portafolio', path: `/barberia/${slug}/perfil`, icon: <Store className="w-4 h-4" /> },
    { label: 'Código QR de Vinculación', path: `/barberia/${slug}/qr`, icon: <QrCode className="w-4 h-4" /> },
    { label: 'Reseñas & Calificaciones', path: `/barberia/${slug}/resenas`, icon: <Star className="w-4 h-4" /> },
    { label: 'Reportes Financieros', path: `/barberia/${slug}/reportes`, icon: <FileSpreadsheet className="w-4 h-4" /> },
  ];

  // Count active walk-ins waiting right now
  const waitingWalkIns = state.appointments.filter(
    a => a.businessId === currentShop?.id && a.date === '2026-10-13' && a.status === 'waiting'
  ).length;

  if (isInicio) {
    return (
      <div className="min-h-[calc(100vh-57px)] bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Mobile Toggle Button */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-12 h-12 rounded-full bg-[var(--gold-primary)] text-black shadow-2xl flex items-center justify-center font-bold"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-[57px] left-0 h-[calc(100vh-57px)] w-64 bg-[#0d0d10]/85 backdrop-blur-2xl border-r border-white/[0.08] p-4 flex flex-col justify-between z-40 transition-transform lg:translate-x-0 shadow-[4px_0_30px_rgba(0,0,0,0.5)] ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="overflow-y-auto pr-1">
          {/* Shop Switcher / Header Badge */}
          <div className="px-3.5 py-3 mb-4 bg-white/[0.04] rounded-2xl border border-white/[0.08] flex items-center gap-3 shadow-inner">
            <img
              src={currentShop?.logo}
              alt={currentShop?.name}
              className="w-10 h-10 rounded-2xl object-cover ring-2 ring-[var(--gold-primary)]/70 shrink-0 shadow-md"
            />
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--gold-primary)] block">
                Panel Barbería
              </span>
              <h2 className="text-xs font-bold text-white truncate">{currentShop?.name}</h2>
              <p className="text-[10px] text-neutral-400 font-mono truncate">{currentShop?.city}</p>
            </div>
          </div>

          {/* Quick Action Walk-in Banner */}
          {waitingWalkIns > 0 && (
            <button
              onClick={() => {
                navigate(`/barberia/${slug}/agenda`);
                setMobileMenuOpen(false);
              }}
              className="w-full mb-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-left flex items-center justify-between group hover:bg-amber-500/20 transition-all duration-200 cursor-pointer active:scale-95 shadow-[0_4px_16px_rgba(245,158,11,0.15)]"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="text-xs font-bold text-amber-300">Sala de Espera:</span>
              </div>
              <span className="text-xs font-mono font-bold text-white bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                {waitingWalkIns} en cola
              </span>
            </button>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1">
            {menuItems.map(item => {
              const isActive = activeRoute === item.path || activeRoute.startsWith(item.path + '/');
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all duration-200 active:scale-98 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#f5c754] to-[#c9931b] text-black font-extrabold shadow-[0_4px_16px_rgba(217,163,35,0.35)]'
                      : 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-black shrink-0" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-white/[0.08] text-[11px] text-neutral-400 flex items-center justify-between font-medium">
          <span className="truncate">Plan Pro Imperio</span>
          <span className="font-mono text-emerald-400 text-[10px] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Activo
          </span>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full animate-apple-enter">
        {children}
      </main>
    </div>
  );
};
