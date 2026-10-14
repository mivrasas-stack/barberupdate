import React from 'react';
import { useApp } from '../../context/AppContext';
import { Star, MessageSquare, UserCheck } from 'lucide-react';

export const BarberiaResenas: React.FC = () => {
  const { currentShop, state } = useApp();
  const shopId = currentShop?.id || 'shop-1';
  const reviews = state.reviews.filter(r => r.businessId === shopId);

  const avgRating = reviews.length
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : '5.0';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Reputación & Experiencia
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Reseñas de Clientes</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Opiniones y calificaciones verificadas emitidas por clientes de la barbería
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#141414] border border-[#262626]">
          <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
          <span className="text-xl font-bold font-mono text-white">{avgRating}</span>
          <span className="text-xs text-neutral-400">/ 5 ({reviews.length} valoraciones)</span>
        </div>
      </div>

      <div className="space-y-3">
        {reviews.map(rev => {
          const barber = state.barbers.find(b => b.id === rev.barberId);

          return (
            <div key={rev.id} className="p-4 rounded-2xl bg-[#141414] border border-[#262626] shadow-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={rev.customerAvatar} alt={rev.customerName} className="w-9 h-9 rounded-full object-cover border border-neutral-700" />
                  <div>
                    <h3 className="font-bold text-white">{rev.customerName}</h3>
                    <div className="text-[11px] text-neutral-400 font-mono">{rev.date}</div>
                  </div>
                </div>
                <div className="flex items-center text-amber-400 font-mono text-sm">
                  {'★'.repeat(rev.rating)}
                </div>
              </div>

              <p className="text-neutral-300 text-xs italic pl-12">"{rev.comment}"</p>

              {barber && (
                <div className="pl-12 pt-1 text-[11px] text-neutral-500">
                  Atendido por: <strong className="text-neutral-300">{barber.name}</strong>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
