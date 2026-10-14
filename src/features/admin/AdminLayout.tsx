import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Home,
  LayoutDashboard,
  Users,
  Store,
  CreditCard,
  Layers,
  Globe,
  ShieldAlert,
  Settings,
  ChevronRight,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRoute, navigate, currentShop } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isInicio = activeRoute === '/admin' || activeRoute === '/admin/' || activeRoute === '/admin/inicio';

  const menuItems = [
    { label: '← Volver al Inicio', path: '/admin/inicio', icon: <Home className="w-4 h-4 text-[var(--gold-primary)]" /> },
    { label: 'Dashboard Global', path: '/admin/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: 'Gestión de Usuarios', path: '/admin/usuarios', icon: <Users className="w-4 h-4" /> },
    { label: 'Franquicias & Barberías', path: '/admin/franquicias', icon: <Store className="w-4 h-4" /> },
    { label: 'Suscripciones', path: '/admin/suscripciones', icon: <CreditCard className="w-4 h-4" /> },
    { label: 'Planes Comerciales', path: '/admin/planes', icon: <Layers className="w-4 h-4" /> },
    { label: 'Editor Página Precios', path: '/admin/editor-comercial', icon: <Globe className="w-4 h-4" /> },
    { label: 'Administradores', path: '/admin/administradores', icon: <ShieldAlert className="w-4 h-4" /> },
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
        className={`fixed lg:sticky top-[57px] left-0 h-[calc(100vh-57px)] w-64 bg-[#121212] border-r border-[#242424] p-4 flex flex-col justify-between z-40 transition-transform lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="px-3 py-2 mb-4 bg-[#181818] rounded-xl border border-[#2a2a2a]">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--gold-primary)] block">
              Plataforma Maestro
            </span>
            <h2 className="text-sm font-bold text-white">Superadmin Global</h2>
            <p className="text-[11px] text-neutral-400">Control Multi-Inquilino</p>
          </div>

          <nav className="space-y-1">
            {menuItems.map(item => {
              const isActive = activeRoute.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[var(--gold-primary)] text-black font-bold shadow-md shadow-[var(--gold-primary)]/10'
                      : 'text-neutral-400 hover:text-white hover:bg-[#1a1a1a]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-black" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Quick jump to a barbershop */}
        <div className="pt-4 border-t border-neutral-800">
          <div className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Vista Rápida Barbería
          </div>
          <button
            onClick={() => navigate(`/barberia/${currentShop?.slug || 'barber-club'}/dashboard`)}
            className="w-full flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-[var(--gold-primary)] text-[11px] text-neutral-300 hover:text-white transition-colors"
          >
            <span className="truncate">{currentShop?.name}</span>
            <ExternalLink className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
};
