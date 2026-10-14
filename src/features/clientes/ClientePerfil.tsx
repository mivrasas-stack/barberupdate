import React from 'react';
import { useApp } from '../../context/AppContext';
import { User, Phone, Mail, Award, Calendar, Scissors, ShieldCheck } from 'lucide-react';

export const ClientePerfil: React.FC = () => {
  const { currentUser, state } = useApp();
  const customerId = currentUser?.id || 'usr-client-1';
  const loyalty = state.loyalty[customerId] || state.loyalty['usr-client-1'] || { points: 420 };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center pb-4 border-b border-[#242424]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
          Configuración Personal
        </span>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Mi Perfil de Cliente</h1>
      </div>

      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 shadow-xl flex items-center gap-4">
        <img
          src={currentUser?.avatar || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80'}
          alt={currentUser?.name || 'Cliente'}
          className="w-16 h-16 rounded-2xl object-cover border-2 border-[var(--gold-primary)]"
        />
        <div>
          <h2 className="text-lg font-bold text-white">{currentUser?.name || 'Camilo Andrés Torres'}</h2>
          <p className="text-xs text-neutral-400">{currentUser?.email || 'camilo.torres@gmail.com'}</p>
          <div className="mt-1 flex items-center gap-2 text-xs font-mono text-neutral-300">
            <span>{currentUser?.phone || '+57 311 222 3344'}</span>
            <span>·</span>
            <span className="text-[var(--gold-primary)] font-bold">{loyalty.points} pts acumulados</span>
          </div>
        </div>
      </div>

      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 space-y-3 text-xs">
        <h3 className="text-sm font-bold text-white">Preferencias de Corte</h3>
        <p className="text-neutral-400">
          Guardamos tus preferencias para que cualquier barbero de la plataforma conozca tu estilo:
        </p>
        <div className="p-3 bg-[#181818] rounded-xl border border-neutral-800 space-y-1.5 text-neutral-300">
          <div>• Estilo habitual: <strong>Degradado medio con navaja (Skin Fade)</strong></div>
          <div>• Longitud superior: <strong>Tijera textura media, peinado hacia atrás</strong></div>
          <div>• Barba: <strong>Perfilado de líneas con toalla caliente y loción sin alcohol</strong></div>
        </div>
      </div>
    </div>
  );
};
