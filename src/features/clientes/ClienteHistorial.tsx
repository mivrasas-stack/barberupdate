import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { barberStore } from '../../services/store';
import { formatCurrency } from '../../utils/formatters';
import { History, Star, MessageSquare, Check, X } from 'lucide-react';
import { Appointment } from '../../types';

export const ClienteHistorial: React.FC = () => {
  const { state, currentUser, currency, addToast } = useApp();
  const customerId = currentUser?.id || 'usr-client-1';

  const myAppointments = state.appointments.filter(a => a.customerId === customerId);
  const [reviewingApt, setReviewingApt] = useState<Appointment | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const handleSendReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingApt || !comment) return;

    barberStore.addReview({
      businessId: reviewingApt.businessId,
      barberId: reviewingApt.barberId,
      customerId,
      customerName: currentUser?.name || 'Camilo Andrés Torres',
      customerAvatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80',
      appointmentId: reviewingApt.id,
      rating,
      comment,
    });

    // Award bonus loyalty points for review
    barberStore.awardLoyaltyPoints(customerId, 25, 'Bono por reseña 5 estrellas');

    addToast('¡Gracias por tu reseña! Recibiste +25 puntos de fidelidad.', 'success');
    setReviewingApt(null);
    setComment('');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Registro Personal
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Historial de Cortes & Reseñas</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Consulta tus citas pasadas y califica la experiencia con tu barbero
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {myAppointments.map(apt => {
          const barber = state.barbers.find(b => b.id === apt.barberId);
          const hasReview = state.reviews.some(r => r.appointmentId === apt.id);

          return (
            <div
              key={apt.id}
              className="p-4 rounded-2xl bg-[#141414] border border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
            >
              <div className="flex items-center gap-3">
                <img
                  src={barber?.photo}
                  alt={barber?.name}
                  className="w-10 h-10 rounded-full object-cover border border-neutral-700 shrink-0"
                />
                <div>
                  <h3 className="font-bold text-white text-sm">{apt.serviceName}</h3>
                  <p className="text-neutral-400">Barbero: <strong className="text-white">{barber?.name}</strong></p>
                  <p className="text-neutral-500 font-mono text-[10px]">{apt.date} a las {apt.startTime}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 self-end sm:self-center">
                <span className="font-mono font-bold text-white text-sm">{formatCurrency(apt.finalPrice, currency)}</span>

                {apt.status === 'completed' && !hasReview && (
                  <button
                    onClick={() => {
                      setReviewingApt(apt);
                      setRating(5);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[var(--gold-primary)] text-black font-bold flex items-center gap-1.5"
                  >
                    <Star className="w-3.5 h-3.5" />
                    <span>Dejar Reseña</span>
                  </button>
                )}

                {hasReview && (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20">
                    ★ Reseña Enviada
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Review Modal */}
      {reviewingApt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <h3 className="text-sm font-bold text-white">Calificar Servicio</h3>
              <button onClick={() => setReviewingApt(null)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendReview} className="py-4 space-y-4 text-xs">
              <div className="text-center">
                <span className="text-neutral-400 block mb-2">Selecciona tu calificación:</span>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      className={`text-2xl transition-transform hover:scale-110 ${
                        star <= rating ? 'text-amber-400' : 'text-neutral-700'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Tu comentario sobre el corte y atención:</label>
                <textarea
                  rows={3}
                  required
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Excelente atención, puntualidad y técnica con navaja..."
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#262626]">
                <button type="button" onClick={() => setReviewingApt(null)} className="px-4 py-2 text-neutral-400">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-[var(--gold-primary)] text-black font-bold">
                  Publicar Reseña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
