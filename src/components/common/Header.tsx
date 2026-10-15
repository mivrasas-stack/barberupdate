import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Palette, ChevronDown, LogOut, User } from 'lucide-react';
import { CurrencyType, UserRole } from '../../types';

export const Header: React.FC = () => {
  const {
    currentUser,
    activeRole,
    activeRoute,
    navigate,
    logout,
    currency,
    setCurrency,
    setIsPaletteModalOpen,
     currentShop,
    currentBarber,
  } = useApp();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getBreadcrumb = () => {
    if (activeRoute.startsWith('/admin')) {
      const part = activeRoute.split('/')[2] || 'inicio';
      return `Superadmin / ${capitalize(part)}`;
    }
    if (activeRoute.startsWith('/barberia/')) {
      const parts = activeRoute.split('/');
      const shopSlug = parts[2];
      const part = parts[3] || 'inicio';
      return `${currentShop?.name || shopSlug} / ${capitalize(part)}`;
    }
    if (activeRoute.startsWith('/barbero/')) {
      const parts = activeRoute.split('/');
      const barberSlug = parts[2];
      const part = parts[3] || 'inicio';
      return `Pro Studio / ${currentBarber?.name || barberSlug} / ${capitalize(part)}`;
    }
    if (activeRoute.startsWith('/clientes')) {
      const part = activeRoute.split('/')[2] || 'inicio';
      return `Portal Clientes / ${capitalize(part)}`;
    }
    return 'BarberNow';
  };

  const capitalize = (str: string) => {
    if (!str) return '';
    return str.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 px-4 sm:px-6 py-2.5 bg-[#0e0e11]/80 backdrop-blur-2xl border-b border-white/[0.08] shadow-[0_4px_30px_rgba(0,0,0,0.5),inset_0_-1px_0_rgba(255,255,255,0.04)] text-[var(--text-primary)] transition-all">
      {/* Zone 1: Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => {
            if (activeRole === 'superadmin') navigate('/admin/inicio');
            else if (activeRole === 'owner') navigate(`/barberia/${currentShop?.slug || 'barber-club'}/inicio`);
            else if (activeRole === 'barber_employee') navigate(`/barbero/${currentBarber?.slug || 'alex-fade'}/inicio`);
            else navigate('/clientes/inicio');
          }}
          aria-label="BarberNow — inicio" className="flex items-center gap-2 text-left group cursor-pointer transition-transform duration-200 active:scale-95"
        >
          <img
            src="/branding/barbernow-logo.png"
            alt=""
            aria-hidden="true"
            className="h-10 w-auto shrink-0 object-contain"
            draggable={false}
          />
          <span className="hidden sm:inline text-base font-extrabold tracking-tight text-white group-hover:text-[var(--gold-primary)] transition-colors whitespace-nowrap">
            BarberNow
          </span>
        </button>

        {/* Separator & Breadcrumb */}
        <div className="hidden md:flex items-center gap-2 pl-3 border-l border-white/10 text-xs text-neutral-400">
          <span className="font-mono text-neutral-600">/</span>
          <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-300 font-medium text-[11px] truncate max-w-xs shadow-inner">
            {getBreadcrumb()}
          </span>
        </div>
      </div>

      {/* Zone 2: Navigation Links or Context Switchers */}
      <div className="hidden lg:flex items-center gap-2 text-xs">
        {currentUser?.businessId && (
          <span className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-neutral-300 text-[11px] font-medium truncate max-w-[220px] shadow-sm backdrop-blur-md">
            📍 {currentShop?.name}
          </span>
        )}
      </div>

      {/* Zone 3: Actions & Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Live Palette Button (User's specific request) */}
        <button
          onClick={() => setIsPaletteModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30 hover:bg-[var(--gold-primary)]/20 hover:border-[var(--gold-primary)]/50 transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-95 shadow-[0_2px_8px_rgba(217,163,35,0.15)]"
          title="Validar y cambiar paleta de colores en vivo"
        >
          <Palette className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
          <span className="hidden sm:inline">Paleta de Colores</span>
        </button>

        {/* Currency Switcher */}
        <div className="relative flex items-center bg-black/40 backdrop-blur-md border border-white/[0.08] rounded-full p-0.5 text-xs font-mono shadow-inner">
          {(['COP', 'USD'] as CurrencyType[]).map(cur => (
            <button
              key={cur}
              onClick={() => setCurrency(cur)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all duration-200 ${
                currency === cur
                  ? 'bg-gradient-to-b from-[#f3c048] to-[#c9931b] text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {cur}
            </button>
          ))}
        </div>

        {/* User Account Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] hover:border-white/20 transition-all duration-200 active:scale-95 cursor-pointer shadow-sm"
          >
            <div className="w-6 h-6 rounded-full overflow-hidden bg-neutral-800 flex items-center justify-center text-xs ring-1 ring-white/20">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-3.5 h-3.5 text-neutral-400" />
              )}
            </div>
            <span className="hidden md:inline text-xs font-medium text-neutral-200 max-w-[120px] truncate">
              {currentUser?.name || 'Invitado'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-[#141417]/95 backdrop-blur-2xl border border-white/[0.1] shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)] p-2 z-50 text-xs animate-apple-enter">
              <div className="px-3 py-2.5 border-b border-white/[0.08]">
                <p className="font-bold text-white truncate">{currentUser?.name || 'Sin sesión'}</p>
                <p className="text-[11px] text-neutral-400 truncate mt-0.5">{currentUser?.email || 'Sin sesión iniciada'}</p>
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#D9A323]/20 text-[#D9A323] border border-[#D9A323]/30">
                  {currentUser?.role ? capitalize(currentUser.role) : 'Público'}
                </span>
              </div>

              <div className="pt-1.5 border-t border-white/[0.08]">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl text-red-400 hover:bg-red-500/15 transition-colors font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
