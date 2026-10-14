import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ChevronDown, LogOut, Scissors, User, Clock } from 'lucide-react';
import { UserRole } from '../../types';
import { formatColombiaLiveClock } from '../../utils/formatters';

export const Header: React.FC = () => {
  const {
    currentUser,
    activeRole,
    activeRoute,
    navigate,
    logout,
    currentShop,
    currentBarber,
  } = useApp();

  const [colombiaTime, setColombiaTime] = useState(() => formatColombiaLiveClock());

  useEffect(() => {
    const timer = setInterval(() => {
      setColombiaTime(formatColombiaLiveClock());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

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

  const capitalize = (str: string) => {
    if (!str) return '';
    return str.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 px-4 sm:px-6 py-2.5 liquid-glass shadow-[0_4px_35px_rgba(0,0,0,0.6)] text-[var(--text-primary)] transition-all">
      {/* Zone 1: Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => {
            if (activeRole === 'superadmin') navigate('/admin/inicio');
            else if (activeRole === 'owner') navigate(`/barberia/${currentShop?.slug || 'barber-club'}/inicio`);
            else if (activeRole === 'barber_independent' || activeRole === 'barber_employee') navigate(`/barbero/${currentBarber?.slug || 'alex-fade'}/inicio`);
            else navigate('/clientes/inicio');
          }}
          className="flex items-center gap-2.5 text-left group cursor-pointer transition-transform duration-200 active:scale-95"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-[#f3c048] to-[#b88928] text-black font-extrabold flex items-center justify-center shadow-[0_2px_10px_rgba(217,163,35,0.4),inset_0_1px_1px_rgba(255,255,255,0.6)] group-hover:shadow-[0_4px_16px_rgba(217,163,35,0.6)] transition-all">
            <Scissors className="w-4 h-4 rotate-45" />
          </div>
          <div>
            <span className="text-base font-extrabold tracking-tight text-white group-hover:text-[var(--gold-primary)] transition-colors whitespace-nowrap">
              Barber<span className="text-[var(--gold-primary)]">OS</span>
            </span>
          </div>
        </button>
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
        {/* Barber-Themed Real-time Colombia Clock */}
        <div
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#17140e] via-[#231d12] to-[#17140e] border border-[#d4af37]/40 shadow-[0_2px_14px_rgba(212,175,55,0.18)] hover:border-[#d4af37]/70 hover:shadow-[0_2px_22px_rgba(212,175,55,0.28)] transition-all duration-300 group cursor-default select-none"
          title="Hora oficial de Colombia (America/Bogota) • BarberOS Live"
        >
          {/* Animated Barber Pole Capsule */}
          <div className="relative w-2.5 h-4.5 rounded-full overflow-hidden shadow-[0_0_8px_rgba(239,68,68,0.45)] ring-1 ring-white/30 shrink-0">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,#dc2626,#dc2626_2.5px,#ffffff_2.5px,#ffffff_5px,#2563eb_5px,#2563eb_7.5px,#ffffff_7.5px,#ffffff_10px)] animate-[pulse_2.5s_ease-in-out_infinite]" />
          </div>

          {/* Clock readout */}
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-[10px] font-black tracking-wider text-[#d4af37] bg-[#d4af37]/15 px-1.5 py-0.5 rounded border border-[#d4af37]/30">
              🇨🇴
            </span>
            <span className="font-bold text-white text-[12px] tracking-tight group-hover:text-[var(--gold-primary)] transition-colors">
              {colombiaTime}
            </span>
          </div>
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
