import React from 'react';
import { useApp } from '../../context/AppContext';
import { Award, Sparkles, Star, Crown, Gift, Check, Flame } from 'lucide-react';

export const ClienteFidelizacion: React.FC = () => {
  const { state, currentUser, addToast } = useApp();

  const customerId = currentUser?.id || 'usr-client-1';
  const loyalty = state.loyalty[customerId] || state.loyalty['usr-client-1'] || {
    points: 420,
    visitsCount: 8,
    currentStreak: 3,
    achievements: [],
    pointHistory: [],
  };

  const rewards = [
    { id: 'rew-1', title: 'Cerveza Club Colombia o Espresso Gratis', pointsCost: 100, isAvailable: loyalty.points >= 100 },
    { id: 'rew-2', title: 'Exfoliación Facial & Mascarilla Negra', pointsCost: 250, isAvailable: loyalty.points >= 250 },
    { id: 'rew-3', title: 'Corte Clásico o Degradado de Cortesía', pointsCost: 500, isAvailable: loyalty.points >= 500 },
  ];

  const handleRedeem = (rewTitle: string, cost: number) => {
    if (loyalty.points < cost) return;
    loyalty.points -= cost;
    loyalty.pointHistory.unshift({
      id: `ph-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      concept: `Canje: ${rewTitle}`,
      points: -cost,
    });
    addToast(`¡Recompensa canjeada! Muestra este cupón al barbero: ${rewTitle}`, 'success');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Club de Beneficios
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Fidelización & Logros</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Gana puntos con cada corte y producto, desbloquea insignias y canjea servicios gratis
          </p>
        </div>
      </div>

      {/* Main Points Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#181818] via-[#141414] to-[#1c1c1c] border border-[var(--gold-primary)]/40 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-bold text-[var(--gold-primary)] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Saldo Acumulado
          </span>
          <div className="text-4xl font-black font-mono text-white mt-1">
            {loyalty.points} <span className="text-sm font-normal text-neutral-400 font-sans">puntos</span>
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-neutral-300">
            <span>{loyalty.visitsCount} visitas registradas</span>
            <span>·</span>
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <Flame className="w-3.5 h-3.5" /> Racha de {loyalty.currentStreak} meses
            </span>
          </div>
        </div>

        <div className="p-4 bg-black/60 rounded-2xl border border-neutral-800 text-xs text-neutral-300 space-y-1">
          <div className="text-[var(--gold-primary)] font-bold">Regla de Acumulación:</div>
          <div>1 punto por cada $1.000 COP en cortes o boutique.</div>
          <div>+25 puntos por calificar con una reseña.</div>
        </div>
      </div>

      {/* Achievements Badges */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-white">Insignias & Logros Desbloqueados</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(loyalty.achievements || []).map(ach => (
            <div
              key={ach.id}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                ach.isUnlocked
                  ? 'border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/5'
                  : 'border-neutral-800 bg-[#181818] opacity-50'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] flex items-center justify-center mb-2">
                <Award className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-white">{ach.title}</h4>
              <p className="text-[11px] text-neutral-400 mt-0.5">{ach.description}</p>
              {ach.isUnlocked && (
                <span className="text-[10px] text-emerald-400 font-mono mt-2 block">
                  ✓ Desbloqueado ({ach.unlockedAt})
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Rewards Catalog */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-white">Recompensas Disponibles para Canjear</h3>
        <div className="space-y-3">
          {rewards.map(rew => (
            <div
              key={rew.id}
              className="p-4 bg-[#181818] rounded-xl border border-neutral-800 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-[var(--gold-primary)]">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{rew.title}</h4>
                  <span className="text-[11px] font-mono text-[var(--gold-primary)] font-bold">
                    {rew.pointsCost} puntos requeridos
                  </span>
                </div>
              </div>

              <button
                disabled={!rew.isAvailable}
                onClick={() => handleRedeem(rew.title, rew.pointsCost)}
                className="px-4 py-2 rounded-xl bg-[var(--gold-primary)] text-black font-bold text-xs disabled:opacity-30 hover:bg-[var(--gold-hover)]"
              >
                Canjear
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
