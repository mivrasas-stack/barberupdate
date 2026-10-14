import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Shield, Store, Scissors, UserCheck, Users, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import { UserRole } from '../../types';

export const RoleSwitcherBar: React.FC = () => {
  const { currentUser, switchRolePersona, resetDemoData, activeRole } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);

  const roles: { role: UserRole; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      role: 'superadmin',
      label: 'Superadmin',
      desc: 'Carlos Mendoza - Plataforma global',
      icon: <Shield className="w-3.5 h-3.5 text-amber-400" />,
    },
    {
      role: 'owner',
      label: 'Barbería (Dueño)',
      desc: 'Mateo Restrepo - Barber Club Bogotá',
      icon: <Store className="w-3.5 h-3.5 text-yellow-400" />,
    },
    {
      role: 'barber_independent',
      label: 'Barbero Independiente',
      desc: 'Alex "The Blade" Fade - Estudio Propio',
      icon: <Scissors className="w-3.5 h-3.5 text-orange-400" />,
    },
    {
      role: 'barber_employee',
      label: 'Barbero Asociado',
      desc: 'Santiago Castro - Silla en Barber Club',
      icon: <Users className="w-3.5 h-3.5 text-blue-400" />,
    },
    {
      role: 'client',
      label: 'Cliente',
      desc: 'Camilo Torres - Reservas y fidelidad',
      icon: <UserCheck className="w-3.5 h-3.5 text-emerald-400" />,
    },
  ];

  return (
    <div className="fixed bottom-5 left-5 z-40 hidden sm:block">
      <div className="liquid-glass rounded-2xl shadow-[0_16px_45px_rgba(0,0,0,0.7)] overflow-hidden transition-all duration-300">
        {/* Dynamic Island Toggle Bar */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-neutral-300 hover:text-white transition-all w-full cursor-pointer active:scale-95"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--gold-primary)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--gold-primary)]"></span>
          </span>
          <span className="text-neutral-400 text-[11px]">Rol activo:</span>
          <span className="font-bold text-white capitalize tracking-wide">{activeRole.replace('_', ' ')}</span>
          <span className="text-[10px] text-neutral-400 font-mono bg-white/[0.06] px-1.5 py-0.5 rounded-full border border-white/[0.05]">
            {currentUser?.name?.split(' ')[0]}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 ml-2 text-neutral-400" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 ml-2 text-neutral-400" />
          )}
        </button>

        {/* Expanded list of roles */}
        {isExpanded && (
          <div className="p-2.5 border-t border-white/[0.08] space-y-1 w-80 animate-apple-enter">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold-primary)] px-2 py-1 flex items-center justify-between">
              <span>Cambio de Perfil Instantáneo</span>
              <span className="text-[9px] text-neutral-500 font-mono">1 Clic</span>
            </div>
            {roles.map(r => {
              const isSelected = activeRole === r.role;
              return (
                <button
                  key={r.role}
                  onClick={() => {
                    switchRolePersona(r.role);
                    setIsExpanded(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs transition-all duration-200 cursor-pointer active:scale-98 ${
                    isSelected
                      ? 'bg-gradient-to-r from-[var(--gold-primary)]/20 to-[var(--gold-primary)]/5 text-white border border-[var(--gold-primary)]/40 font-semibold shadow-sm'
                      : 'text-neutral-300 hover:bg-white/[0.08] hover:text-white border border-transparent'
                  }`}
                >
                  <div className="shrink-0 p-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08]">
                    {r.icon}
                  </div>
                  <div className="truncate flex-1">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      {r.label}
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold-primary)]" />}
                    </div>
                    <div className="text-[10px] text-neutral-400 truncate">{r.desc}</div>
                  </div>
                </button>
              );
            })}

            <div className="pt-2 mt-1.5 border-t border-white/[0.08] flex justify-between items-center px-1 text-[11px]">
              <button
                onClick={resetDemoData}
                className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer active:scale-95"
                title="Restablece las citas, inventario y ventas originales"
              >
                <RefreshCw className="w-3 h-3 text-blue-400" />
                <span>Reiniciar Demo</span>
              </button>
              <span className="text-[10px] font-mono text-neutral-500">BarberOS · Apple UI</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
