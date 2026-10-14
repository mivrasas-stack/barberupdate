import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { barberStore } from '../../services/store';
import {isLiveBackend,addBooking,refreshLiveData} from '../../services/liveBackend';
import { formatCurrency } from '../../utils/formatters';
import {
  Calendar,
  Clock,
  Scissors,
  Store,
  User,
  Star,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { Barbershop, Barber, Service } from '../../types';

export const ClienteReservas: React.FC = () => {
  const { state, currentUser, currency, navigate, addToast } = useApp();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Selections
  const [selectedTargetType, setSelectedTargetType] = useState<'shop' | 'independent'>('shop');
  const [selectedShop, setSelectedShop] = useState<Barbershop>(state.barbershops[0]);
  const [selectedIndependentBarber, setSelectedIndependentBarber] = useState<Barber>(
    state.barbers.find(b => b.isIndependent) || state.barbers[0]
  );
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date(Date.now()+86400000).toISOString().slice(0,10));
  const [selectedTime, setSelectedTime] = useState('11:00');
  const [notes, setNotes] = useState('');

  // Available barbers for this shop/service
  const availableBarbers = selectedTargetType === 'shop'
    ? state.barbers.filter(b => b.businessId === selectedShop.id)
    : [selectedIndependentBarber];

  // Available services
  const availableServices = selectedTargetType === 'shop'
    ? state.services.filter(s => s.businessId === selectedShop.id)
    : state.services.filter(s => s.barberId === selectedIndependentBarber.id || s.barberIds.includes(selectedIndependentBarber.id));

  // Time slots for the chosen day
  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  ];

  const handleConfirmReservation = async () => {
    if (!selectedService || !selectedBarber) return;
    if(isLiveBackend){
      if(selectedTargetType!=='shop'||!selectedShop?.id){
        addToast('Selecciona una barbería publicada en BarberOS.','error');return;
      }
      const phone=currentUser?.phone?.trim()||window.prompt('Ingresa tu teléfono para confirmar la reserva:')?.trim();
      if(!phone){addToast('Necesitamos tu teléfono para la reserva.','error');return;}
      try{
        await addBooking(selectedShop.id,{barberId:selectedBarber.id,
          serviceId:selectedService.id,date:selectedDate,startTime:selectedTime,
          customerName:currentUser?.name||currentUser?.email||'Cliente',
          customerPhone:phone,notes});
        await refreshLiveData();
        addToast('¡Reserva registrada en el backend!','success');
        setStep(6);
      }catch(error){addToast(error instanceof Error?error.message:'No se pudo reservar','error');}
      return;
    }

    const res = barberStore.createAppointment({
      businessId: selectedTargetType === 'shop' ? selectedShop.id : undefined,
      barberId: selectedBarber.id,
      customerId: currentUser?.id || 'usr-client-1',
      customerName: currentUser?.name || 'Camilo Andrés Torres',
      customerPhone: currentUser?.phone || '+57 311 222 3344',
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      date: selectedDate,
      startTime: selectedTime,
      endTime: '12:00',
      durationMinutes: selectedService.durationMinutes,
      price: selectedService.price,
      discount: 0,
      finalPrice: selectedService.price,
      status: 'confirmed',
      notes,
    });

    if (!res.success) {
      addToast(res.error || 'Horario no disponible para este barbero', 'error');
      return;
    }

    addToast('¡Cita confirmada exitosamente! Se ha sincronizado en la agenda del profesional.', 'success');
    setStep(6); // Confirmation screen
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Wizard Header */}
      <div className="text-center pb-4 border-b border-[#242424]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
          Paso {step} de 5
        </span>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          {step === 1 && 'Paso 1: Elige Barbería o Profesional'}
          {step === 2 && 'Paso 2: Selecciona el Servicio'}
          {step === 3 && 'Paso 3: Elige tu Barbero de Preferencia'}
          {step === 4 && 'Paso 4: Fecha & Franja Horaria'}
          {step === 5 && 'Paso 5: Resumen & Confirmación'}
          {step === 6 && '¡Reserva Completada!'}
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          {step < 6 ? 'Agenda tu cita en segundos con disponibilidad en tiempo real' : 'Tu barbero ya fue notificado'}
        </p>

        {/* Progress Dots */}
        {step <= 5 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3, 4, 5].map(s => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-8 bg-[var(--gold-primary)]'
                    : s < step
                    ? 'w-3 bg-neutral-600'
                    : 'w-3 bg-neutral-800'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Step 1: Choose Barbershop or Independent Barber */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setSelectedTargetType('shop')}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedTargetType === 'shop'
                  ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-white font-bold'
                  : 'border-[#262626] bg-[#141414] text-neutral-400'
              }`}
            >
              <Store className="w-4 h-4 mb-1 text-[var(--gold-primary)]" />
              <span>Barberías Comerciales</span>
            </button>
            <button
              onClick={() => setSelectedTargetType('independent')}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedTargetType === 'independent'
                  ? 'border-orange-500 bg-orange-500/10 text-white font-bold'
                  : 'border-[#262626] bg-[#141414] text-neutral-400'
              }`}
            >
              <Scissors className="w-4 h-4 mb-1 text-orange-400" />
              <span>Barberos Independientes</span>
            </button>
          </div>

          {selectedTargetType === 'shop' ? (
            <div className="space-y-3">
              {state.barbershops.map(shop => {
                const isSelected = selectedShop.id === shop.id;
                return (
                  <button
                    key={shop.id}
                    onClick={() => setSelectedShop(shop)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-[var(--gold-primary)] bg-[#1a1a1a] shadow-lg shadow-[var(--gold-primary)]/5 ring-1 ring-[var(--gold-primary)]/40'
                        : 'border-[#262626] bg-[#141414] hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img src={shop.logo} alt={shop.name} className="w-12 h-12 rounded-xl object-cover border border-neutral-700" />
                      <div>
                        <h3 className="text-sm font-bold text-white">{shop.name}</h3>
                        <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                          <span>{shop.address}, {shop.city}</span>
                        </p>
                        <div className="flex items-center gap-1 text-amber-400 text-xs font-mono mt-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          <span>{shop.rating}</span>
                          <span className="text-neutral-500 font-normal">({shop.reviewsCount} reseñas)</span>
                        </div>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-[var(--gold-primary)] shrink-0" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {state.barbers.filter(b => b.isIndependent).map(ind => {
                const isSelected = selectedIndependentBarber.id === ind.id;
                return (
                  <button
                    key={ind.id}
                    onClick={() => {
                      setSelectedIndependentBarber(ind);
                      setSelectedBarber(ind);
                    }}
                    className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-orange-500 bg-[#1a1a1a] ring-1 ring-orange-500/40'
                        : 'border-[#262626] bg-[#141414] hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img src={ind.photo} alt={ind.name} className="w-12 h-12 rounded-full object-cover border border-neutral-700" />
                      <div>
                        <h3 className="text-sm font-bold text-white">{ind.name}</h3>
                        <p className="text-xs text-orange-400 font-medium">{ind.specialties.join(' · ')}</p>
                        <div className="flex items-center gap-1 text-amber-400 text-xs font-mono mt-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          <span>{ind.rating} (VIP)</span>
                        </div>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-orange-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black font-bold text-xs hover:bg-[var(--gold-hover)] flex items-center gap-1.5"
            >
              <span>Continuar a Servicios</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Choose Service */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-3">
            {availableServices.map(srv => {
              const isSelected = selectedService?.id === srv.id;
              return (
                <button
                  key={srv.id}
                  onClick={() => setSelectedService(srv)}
                  className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-[var(--gold-primary)] bg-[#1a1a1a] ring-1 ring-[var(--gold-primary)]/40'
                      : 'border-[#262626] bg-[#141414] hover:border-neutral-700'
                  }`}
                >
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--gold-primary)] block">
                      {srv.category}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-0.5">{srv.name}</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">{srv.description}</p>
                    <span className="text-[11px] text-neutral-500 font-mono mt-1 block">
                      Duración estimada: {srv.durationMinutes} minutos
                    </span>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <span className="text-base font-bold font-mono text-[var(--gold-primary)]">
                      {formatCurrency(srv.price, currency)}
                    </span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-[var(--gold-primary)] mt-1 ml-auto" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-neutral-400 text-xs hover:text-white flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
            <button
              disabled={!selectedService}
              onClick={() => {
                if (selectedTargetType === 'independent') {
                  setSelectedBarber(selectedIndependentBarber);
                  setStep(4); // Skip barber picker if independent
                } else {
                  setStep(3);
                }
              }}
              className="px-6 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black font-bold text-xs disabled:opacity-40 hover:bg-[var(--gold-hover)] flex items-center gap-1.5"
            >
              <span>Continuar</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Choose Barber */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {availableBarbers.map(barber => {
              const isSelected = selectedBarber?.id === barber.id;
              return (
                <button
                  key={barber.id}
                  onClick={() => setSelectedBarber(barber)}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-[var(--gold-primary)] bg-[#1a1a1a] ring-1 ring-[var(--gold-primary)]/40'
                      : 'border-[#262626] bg-[#141414] hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <img src={barber.photo} alt={barber.name} className="w-12 h-12 rounded-xl object-cover border border-neutral-700" />
                    <div>
                      <h3 className="text-sm font-bold text-white">{barber.name}</h3>
                      <div className="flex items-center gap-1 text-amber-400 text-xs font-mono">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span>{barber.rating}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-400 line-clamp-2">{barber.bio}</p>
                  <div className="mt-3 pt-2 border-t border-neutral-800 text-[11px] text-[var(--gold-primary)] font-medium">
                    {barber.specialties.join(' · ')}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between pt-4">
            <button onClick={() => setStep(2)} className="px-4 py-2 text-neutral-400 text-xs hover:text-white flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
            <button
              disabled={!selectedBarber}
              onClick={() => setStep(4)}
              className="px-6 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black font-bold text-xs disabled:opacity-40 hover:bg-[var(--gold-hover)] flex items-center gap-1.5"
            >
              <span>Elegir Horario</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Choose Date & Time */}
      {step === 4 && (
        <div className="space-y-5 bg-[#141414] border border-[#262626] rounded-2xl p-6">
          <div>
            <label className="text-xs text-neutral-300 font-semibold block mb-2">Selecciona la Fecha:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full bg-[#181818] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-300 font-semibold block mb-2">Franjas Horarias Disponibles:</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {timeSlots.map(time => {
                // Check if already booked for this barber and date
                const isBooked = state.appointments.some(
                  a => a.barberId === selectedBarber?.id && a.date === selectedDate && a.startTime === time && a.status !== 'cancelled'
                );
                const isSelected = selectedTime === time;

                return (
                  <button
                    key={time}
                    disabled={isBooked}
                    onClick={() => setSelectedTime(time)}
                    className={`py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                      isBooked
                        ? 'bg-neutral-900/40 text-neutral-600 border border-neutral-900 cursor-not-allowed line-through'
                        : isSelected
                        ? 'bg-[var(--gold-primary)] text-black shadow-md'
                        : 'bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-300 hover:border-neutral-600'
                    }`}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs text-neutral-300 font-semibold block mb-1">Notas especiales (Opcional):</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej. Tengo el cabello rizado, quiero mantener volumen arriba..."
              className="w-full bg-[#181818] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-xs text-white"
            />
          </div>

          <div className="flex justify-between pt-4 border-t border-neutral-800">
            <button onClick={() => setStep(selectedTargetType === 'independent' ? 2 : 3)} className="px-4 py-2 text-neutral-400 text-xs hover:text-white flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
            <button
              onClick={() => setStep(5)}
              className="px-6 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black font-bold text-xs hover:bg-[var(--gold-hover)] flex items-center gap-1.5"
            >
              <span>Revisar Resumen</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Summary & Confirm */}
      {step === 5 && (
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-4">
          <div className="p-4 bg-[#181818] rounded-xl border border-neutral-800 space-y-3 text-xs">
            <div className="flex justify-between text-neutral-400">
              <span>Lugar:</span>
              <strong className="text-white">
                {selectedTargetType === 'shop' ? selectedShop.name : 'Estudio Privado Independiente'}
              </strong>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>Profesional Asignado:</span>
              <strong className="text-[var(--gold-primary)]">{selectedBarber?.name}</strong>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>Servicio:</span>
              <strong className="text-white">{selectedService?.name}</strong>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>Fecha & Hora:</span>
              <strong className="text-white font-mono">{selectedDate} a las {selectedTime}</strong>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>Duración Estimada:</span>
              <strong className="text-neutral-300 font-mono">{selectedService?.durationMinutes} minutos</strong>
            </div>
            <div className="pt-3 border-t border-neutral-700 flex justify-between text-sm font-bold">
              <span className="text-white">Total a Cancelar en Local:</span>
              <span className="font-mono text-emerald-400">
                {formatCurrency(selectedService?.price || 0, currency)}
              </span>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-neutral-800">
            <button onClick={() => setStep(4)} className="px-4 py-2 text-neutral-400 text-xs hover:text-white flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              <span>Modificar Fecha</span>
            </button>
            <button
              onClick={handleConfirmReservation}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 text-black font-extrabold text-xs hover:bg-emerald-400 flex items-center gap-1.5 shadow-lg shadow-emerald-500/10"
            >
              <span>Confirmar Mi Reserva</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Success Confirmation */}
      {step === 6 && (
        <div className="bg-[#141414] border border-[var(--gold-primary)]/40 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h2 className="text-xl font-bold text-white">¡Tu Cita Ha Sido Agendada con Éxito!</h2>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">
            Hemos reservado tu franja de {selectedTime} el {selectedDate}. Recuerda llegar 5 minutos antes para disfrutar de tu café en la sala de espera.
          </p>

          <div className="p-4 bg-[#181818] rounded-xl border border-neutral-800 max-w-sm mx-auto text-xs space-y-1 text-left">
            <div className="text-neutral-400">Servicio: <strong className="text-white">{selectedService?.name}</strong></div>
            <div className="text-neutral-400">Profesional: <strong className="text-[var(--gold-primary)]">{selectedBarber?.name}</strong></div>
            <div className="text-neutral-400">Total: <strong className="font-mono text-white">{formatCurrency(selectedService?.price || 0, currency)}</strong></div>
          </div>

          <div className="pt-4 flex justify-center gap-3">
            <button
              onClick={() => navigate('/clientes/dashboard')}
              className="px-5 py-2.5 rounded-xl bg-[#202020] hover:bg-[#282828] text-white text-xs font-semibold"
            >
              Ir a Mi Panel
            </button>
            <button
              onClick={() => navigate('/clientes/sala-espera')}
              className="px-5 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black text-xs font-bold hover:bg-[var(--gold-hover)]"
            >
              Ver Sala de Espera
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
