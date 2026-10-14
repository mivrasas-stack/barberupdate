import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Home,
  LayoutDashboard,
  Calendar,
  Coffee,
  ShoppingBag,
  Award,
  History,
  QrCode,
  User,
  Menu,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export const ClienteLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRoute, navigate, state, currentUser } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const customerId = currentUser?.id || 'usr-client-1';
  const loyalty = state.loyalty[customerId] || state.loyalty['usr-client-1'] || { points: 420 };

  const isInicio = activeRoute === '/clientes/inicio' || activeRoute === '/clientes' || activeRoute === '/clientes/';

  const menuItems = [
    { label: '← Volver al Inicio', path: '/clientes/inicio', icon: <Home className="w-4 h-4 text-[var(--gold-primary)]" /> },
    { label: 'Mi Panel', path: '/clientes/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: 'Agendar Cita', path: '/clientes/citas/nueva', icon: <Calendar className="w-4 h-4" /> },
    { label: 'Sala de Espera & Pedidos', path: '/clientes/sala-espera', icon: <Coffee className="w-4 h-4" /> },
    { label: 'Puntos & Fidelidad', path: '/clientes/fidelizacion', icon: <Award className="w-4 h-4" /> },
    { label: 'Historial & Reseñas', path: '/clientes/historial', icon: <History className="w-4 h-4" /> },
    { label: 'Escanear / Vincular QR', path: '/clientes/vincular', icon: <QrCode className="w-4 h-4" /> },
    { label: 'Mi Perfil', path: '/clientes/perfil', icon: <User className="w-4 h-4" /> },
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
          {/* Customer Badge with Loyalty Points */}
          <div className="p-3 mb-4 bg-gradient-to-br from-[#1a1a1a] to-[#141414] rounded-2xl border border-[#2a2a2a] shadow-lg">
            <div className="flex items-center gap-2.5">
              <img
                src={currentUser?.avatar || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80'}
                alt={currentUser?.name || 'Cliente'}
                className="w-10 h-10 rounded-full object-cover border-2 border-[var(--gold-primary)] shrink-0"
              />
              <div className="truncate">
                <h3 className="text-xs font-bold text-white truncate">{currentUser?.name || 'Camilo Torres'}</h3>
                <span className="text-[10px] text-neutral-400">Cliente Preferencial</span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-neutral-800 flex items-center justify-between text-xs">
              <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[var(--gold-primary)]" />
                Puntos:
              </span>
              <span className="font-mono font-bold text-[var(--gold-primary)]">{loyalty.points} pts</span>
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
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[var(--gold-primary)] text-black font-bold shadow-md shadow-[var(--gold-primary)]/10'
                      : 'text-neutral-400 hover:text-white hover:bg-[#1a1a1a]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-black shrink-0" />}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-3 border-t border-neutral-800 text-[11px] text-neutral-500">
          <span>Barbería vinculada:</span>
          <div className="font-semibold text-neutral-300 truncate">Barber Club Bogotá</div>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
};
