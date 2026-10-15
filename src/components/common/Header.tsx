import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Palette, ChevronDown, LogOut, User } from 'lucide-react';
import { CurrencyType, UserRole } from '../../types';

const COLOMBIA_TIME_ZONE = 'America/Bogota';

/** Actualización local sin peticiones de red: la fecha y la hora siempre corresponden a Colombia. */
const ColombiaClock: React.FC = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const update = () => setNow(new Date());
    const interval = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  const dateLabel = new Intl.DateTimeFormat('es-CO', {
    timeZone: COLOMBIA_TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  }).format(now);
  const shortDate = new Intl.DateTimeFormat('es-CO', {
    timeZone: COLOMBIA_TIME_ZONE, day: 'numeric', month: 'short'
  }).format(now);
  const timeLabel = new Intl.DateTimeFormat('es-CO', {
    timeZone: COLOMBIA_TIME_ZONE, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
  }).format(now);
  const shortTime = new Intl.DateTimeFormat('es-CO', {
    timeZone: COLOMBIA_TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true
  }).format(now);

  return (
    <div
      data-testid="barbernow-header-clock"
      role="timer"
      aria-label={`Fecha y hora de Colombia: ${dateLabel}, ${timeLabel}`}
      title="Fecha y hora de Colombia (Bogotá, UTC−5)"
      className="flex h-10 shrink-0 items-center gap-1.5 sm:gap-2 rounded-full border border-[#8b6b27]/70 bg-gradient-to-b from-[#211b11] to-[#120f0c] px-2 sm:px-3 shadow-[0_0_18px_rgba(210,158,42,0.14)]"
    >
      <span aria-hidden="true" className="text-lg leading-none">💈</span>
      <span aria-hidden="true" className="rounded-md border border-[#ad852e]/50 bg-[#b28a29]/20 px-1.5 py-1 font-mono text-[9px] font-bold text-[#ebc864]">CO</span>
      <span className="flex min-w-0 flex-col leading-[1.12] tabular-nums">
        <time dateTime={now.toISOString()} className="hidden sm:block whitespace-nowrap text-[10px] font-medium text-[#d2b77d]">{dateLabel}</time>
        <time dateTime={now.toISOString()} className="hidden sm:block whitespace-nowrap text-[12px] font-extrabold text-white">{timeLabel}</time>
        <time dateTime={now.toISOString()} className="sm:hidden whitespace-nowrap text-[10px] font-extrabold text-white">{shortTime}</time>
        <span className="sm:hidden whitespace-nowrap text-[9px] text-[#d2b77d]">{shortDate}</span>
      </span>
    </div>
  );
};

export const Header: React.FC = () => {
  const {
    currentUser,
    activeRole,
    navigate,
    logout,
    currency,
    setCurrency,
    setIsPaletteModalOpen,
     currentShop,
    currentBarber,
    state,
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

  const capitalize = (str: string) => {
    if (!str) return '';
    return str.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const activeShopName = activeRole === 'owner'
    ? currentShop?.name
    : activeRole === 'barber_employee'
      ? state.barbershops.find(shop => shop.id === currentBarber?.businessId)?.name
      : activeRole === 'client' && currentUser?.businessId
        ? state.barbershops.find(shop => shop.id === currentUser.businessId)?.name
        : undefined;

  return (
    <header className="sticky top-0 z-40 flex h-[57px] items-center justify-between gap-2 px-3 sm:px-6 bg-[#0e0e11]/80 backdrop-blur-2xl border-b border-white/[0.08] shadow-[0_4px_30px_rgba(0,0,0,0.5),inset_0_-1px_0_rgba(255,255,255,0.04)] text-[var(--text-primary)] transition-all">
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

      </div>

      {/* Identidad de la sede, centrada como en la referencia: nunca muestra una sede inventada. */}
      {activeShopName && (
        <div className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 2xl:flex max-w-[240px]">
          <span className="max-w-full truncate rounded-full border border-white/[0.12] bg-[#272729] px-3 py-1.5 text-[11px] font-semibold text-neutral-300 shadow-inner">
            <span aria-hidden="true" className="mr-1">📍</span>{activeShopName}
          </span>
        </div>
      )}

      {/* Zone 3: Actions & Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Reloj de fecha/hora Colombia: usa la hora real del dispositivo. */}
        <ColombiaClock />

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

              {/* Conservamos las preferencias sin recargar la barra superior. */}
              <button
                type="button"
                onClick={() => { setIsUserMenuOpen(false); setIsPaletteModalOpen(true); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-neutral-300 transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                <Palette className="h-4 w-4 text-[var(--gold-primary)]" />
                <span>Paleta de Colores</span>
              </button>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-neutral-300">
                <span>Moneda</span>
                <div role="group" aria-label="Seleccionar moneda" className="flex rounded-full border border-white/[0.1] bg-black/40 p-0.5">
                  {(['COP', 'USD'] as CurrencyType[]).map(cur => (
                    <button
                      key={cur}
                      type="button"
                      aria-pressed={currency === cur}
                      onClick={() => setCurrency(cur)}
                      className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold transition-colors ${currency === cur
                        ? 'bg-gradient-to-b from-[#f3c048] to-[#c9931b] text-black'
                        : 'text-neutral-400 hover:text-white'}`}
                    >
                      {cur}
                    </button>
                  ))}
                </div>
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
