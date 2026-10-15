import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Home,
  LayoutDashboard,
  Calendar,
  Wallet,
  UserCheck,
  ShoppingBag,
  Scissors,
  User,
  QrCode,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';

export const BarberoLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentBarber, activeRoute, navigate } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const slug = currentBarber?.slug || 'alex-fade';
  const isInicio = activeRoute === `/barbero/${slug}/inicio` || activeRoute === `/barbero/${slug}` || activeRoute === `/barbero/${slug}/`;

  const menuItems = [
    { label: '← Volver al Inicio', path: `/barbero/${slug}/inicio`, icon: <Home className="w-4 h-4 text-[var(--gold-primary)]" /> },
    { label: 'Mi Dashboard', path: `/barbero/${slug}/dashboard`, icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: 'Mi Agenda', path: `/barbero/${slug}/agenda`, icon: <Calendar className="w-4 h-4" /> },
    { label: 'Mi Contabilidad', path: `/barbero/${slug}/contabilidad`, icon: <Wallet className="w-4 h-4" /> },
    { label: 'Mis Clientes', path: `/barbero/${slug}/clientes`, icon: <UserCheck className="w-4 h-4" /> },
    { label: 'Mi Boutique', path: `/barbero/${slug}/boutique`, icon: <ShoppingBag className="w-4 h-4" /> },
    { label: 'Mis Servicios', path: `/barbero/${slug}/servicios`, icon: <Scissors className="w-4 h-4" /> },
    { label: 'Mi Perfil & Portafolio', path: `/barbero/${slug}/perfil`, icon: <User className="w-4 h-4" /> },
    { label: 'Mi Código QR', path: `/barbero/${slug}/qr`, icon: <QrCode className="w-4 h-4" /> },
  ];

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
      {/* Mobile Menu Button */}
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
        <div>
          {/* Barber Header Badge */}
          <div className="px-3.5 py-3 mb-4 bg-white/[0.04] rounded-2xl border border-white/[0.08] flex items-center gap-3 shadow-inner">
            {currentBarber?.photo
              ? <img src={currentBarber.photo} alt="Fotografía profesional" className="w-10 h-10 rounded-2xl object-cover ring-2 ring-[var(--gold-primary)]/70 shrink-0 shadow-md"/>
              : <div className="w-10 h-10 rounded-2xl bg-[#252525] ring-2 ring-[var(--gold-primary)]/70 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-neutral-400"/>
                </div>}
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold tracking-wider text-orange-400 block">
                Barbero Pro
              </span>
              <h2 className="text-xs font-bold text-white truncate">{currentBarber?.name}</h2>
              <p className="text-[10px] text-neutral-400 font-mono">Equipo de barbería</p>
            </div>
          </div>

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

        <div className="pt-3 border-t border-white/[0.08] text-[11px] text-neutral-400 flex items-center justify-between font-medium">
          <span>Plan Barbero Élite</span>
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
