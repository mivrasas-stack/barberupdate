import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  Calendar,
  Clock,
  Award,
  Coffee,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  QrCode,
  MapPin,
  Star,
} from 'lucide-react';

export const ClienteDashboard: React.FC = () => {
  const { state, currentUser, currency, navigate } = useApp();

  const customerId = currentUser?.id || 'usr-client-1';
  const loyalty = state.loyalty[customerId] || state.loyalty['usr-client-1'] || {
    points: 420,
    visitsCount: 8,
    currentStreak: 3,
    achievements: [],
    pointHistory: [],
  };

  // Find next upcoming appointment
  const myAppointments = state.appointments.filter(a => a.customerId === customerId);
  const nextAppointment = myAppointments.find(a => a.status === 'confirmed' || a.status === 'waiting' || a.status === 'in_service');
  const pastAppointments = myAppointments.filter(a => a.status === 'completed');

  // Pending boutique orders to pick up
  const pendingOrders = state.orders.filter(
    o => o.customerId === customerId && o.status !== 'delivered' && o.status !== 'cancelled'
  );

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Bienvenido a tu Experiencia
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Hola, {currentUser?.name || 'Camilo'}
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Reserva tus cortes favoritos, pide bebidas desde la sala de espera y acumula puntos
          </p>
        </div>

        <button
          onClick={() => navigate('/clientes/citas/nueva')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black text-xs font-bold hover:bg-[var(--gold-hover)] transition-all shadow-lg shadow-[var(--gold-primary)]/10"
        >
          <Calendar className="w-4 h-4" />
          <span>Agendar Nueva Cita</span>
        </button>
      </div>

      {/* Hero Strip: Next Appointment or Empty State */}
      <div className="liquid-glass rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[var(--gold-primary)]/15 border border-[var(--gold-primary)]/30 text-[var(--gold-primary)] text-xs font-bold mb-3 shadow-inner">
              <Clock className="w-3.5 h-3.5" />
              <span>{nextAppointment ? 'Tu Próxima Cita Confirmada' : 'Sin Cita Programada'}</span>
            </div>

            {nextAppointment ? (
              <div>
                <h2 className="text-xl font-bold text-white">{nextAppointment.serviceName}</h2>
                <p className="text-xs text-neutral-300 mt-1">
                  Atendido por <strong className="text-[var(--gold-primary)]">{state.barbers.find(b => b.id === nextAppointment.barberId)?.name}</strong> en <strong className="text-white">Barber Club Bogotá</strong>
                </p>
                <div className="mt-3 flex items-center gap-4 text-xs font-mono text-neutral-300">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[var(--gold-primary)]" />
                    {nextAppointment.date}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[var(--gold-primary)]" />
                    {nextAppointment.startTime} ({nextAppointment.durationMinutes} min)
                  </span>
                  <span className="font-bold text-white">{formatCurrency(nextAppointment.finalPrice, currency)}</span>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-bold text-white">¿Listo para un cambio de estilo?</h2>
                <p className="text-xs text-neutral-400 mt-1">
                  Elige tu barbero de confianza y aparta tu cupo sin filas ni esperas.
                </p>
              </div>
            )}
          </div>

          <div className="shrink-0 flex items-center gap-3">
            {nextAppointment ? (
              <button
                onClick={() => navigate('/clientes/sala-espera')}
                className="px-4 py-2.5 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/30 transition-all flex items-center gap-2 shadow-md active:scale-95"
              >
                <Coffee className="w-4 h-4 text-amber-400" />
                <span>Sala de Espera & Bebidas</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/clientes/citas/nueva')}
                className="px-5 py-2.5 rounded-2xl apple-button-gold text-black font-extrabold text-xs shadow-md"
              >
                Reservar Ahora
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pending Orders Box (Obligatory Pickup Code) */}
      {pendingOrders.length > 0 && (
        <div className="p-5 rounded-3xl liquid-glass border border-amber-500/30 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4" /> Pedido Pendiente de Recoger en Caja
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black shadow-sm">
              Listo en Barra
            </span>
          </div>

          {pendingOrders.map(ord => (
            <div key={ord.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
              <div>
                <p className="text-xs text-white">
                  {ord.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                </p>
                <p className="text-[11px] text-neutral-400">Total a pagar en caja: {formatCurrency(ord.total, currency)}</p>
              </div>

              <div className="text-center sm:text-right p-3.5 bg-black/60 rounded-2xl border border-white/10 shadow-inner">
                <span className="text-[10px] text-neutral-400 uppercase block font-semibold">Código de Recogida:</span>
                <span className="text-xl font-mono font-black text-[var(--gold-primary)] tracking-widest">
                  {ord.pickupCode}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Three Column Cards: Loyalty & Quick Services */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Loyalty Points */}
        <div className="liquid-glass-card rounded-3xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-semibold">Club de Puntos VIP</span>
              <Award className="w-4 h-4 text-[var(--gold-primary)]" />
            </div>
            <div className="text-3xl font-bold font-mono text-[var(--gold-primary)]">
              {loyalty.points} <span className="text-xs font-normal text-neutral-400 font-sans">puntos</span>
            </div>
            <p className="text-xs text-neutral-400 mt-2">
              Te faltan solo 80 puntos para tu próximo corte gratis de cortesía.
            </p>
          </div>

          <button
            onClick={() => navigate('/clientes/fidelizacion')}
            className="mt-4 pt-3 border-t border-neutral-800 text-xs font-semibold text-[var(--gold-primary)] hover:underline flex items-center justify-between"
          >
            <span>Ver recompensas e insignias</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Linked Barbershop */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-semibold">Mi Barbería Favorita</span>
              <MapPin className="w-4 h-4 text-neutral-400" />
            </div>
            <h3 className="text-base font-bold text-white">Barber Club Bogotá</h3>
            <p className="text-xs text-neutral-400 mt-1">Calle 93 # 12-45, Chicó Norte</p>
            <div className="mt-2 text-xs text-amber-400 flex items-center gap-1 font-mono">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>4.9 (184 reseñas)</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/clientes/vincular')}
            className="mt-4 pt-3 border-t border-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white flex items-center justify-between"
          >
            <span>Vincular con QR otra barbería</span>
            <QrCode className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
          </button>
        </div>

        {/* Waiting Room Boutique Shortcut */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-semibold">Boutique & Bar</span>
              <Coffee className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-base font-bold text-white">Sala de Espera</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Pide tu café de especialidad, cerveza fría o pomada mate para que esté lista al llegar a tu cita.
            </p>
          </div>

          <button
            onClick={() => navigate('/clientes/sala-espera')}
            className="mt-4 pt-3 border-t border-neutral-800 text-xs font-semibold text-[var(--gold-primary)] hover:underline flex items-center justify-between"
          >
            <span>Abrir Carta & Boutique</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
