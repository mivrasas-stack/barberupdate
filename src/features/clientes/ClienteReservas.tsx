import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { barberStore } from '../../services/store';
import {isLiveBackend,addBooking,refreshLiveData,getAvailabilitySlots} from '../../services/liveBackend';
import {useCustomerLinks} from '../../services/useCustomerLinks';
import { formatCurrency, getColombiaDateString, getColombiaTimeParts } from '../../utils/formatters';
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
  Check,
} from 'lucide-react';
import { Barbershop, Barber, Service } from '../../types';

export const ClienteReservas: React.FC = () => {
  const { state, currentUser, currency, navigate, addToast } = useApp();
  const {items:linkedBusinesses,profile:customerProfile}=useCustomerLinks(currentUser?.id);
  const linkedIds=new Set(linkedBusinesses.map(link=>link.tenant_id));
  const shopsToShow=state.barbershops.filter(s=>!isLiveBackend||s.businessKind!=='independent')
    .sort((a,b)=>Number(linkedIds.has(b.id))-Number(linkedIds.has(a.id)));
  const independentToShow=state.barbers.filter(b=>b.isIndependent)
    .sort((a,b)=>Number(linkedIds.has(b.businessId||''))-Number(linkedIds.has(a.businessId||'')));

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Selections
  const [selectedTargetType, setSelectedTargetType] = useState<'shop' | 'independent'>('shop');
  const [selectedShop, setSelectedShop] = useState<Barbershop>(() =>
    shopsToShow.find(shop=>state.services.some(service=>service.businessId===shop.id)
      &&state.barbers.some(barber=>barber.businessId===shop.id))||shopsToShow[0]);
  const [selectedIndependentBarber, setSelectedIndependentBarber] = useState<Barber>(
    state.barbers.find(b => b.isIndependent) || state.barbers[0]
  );
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => getColombiaDateString());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const [y, m] = getColombiaDateString().split('-').map(Number);
    return new Date(y, (m || 1) - 1, 1);
  });
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [whatsappOptIn,setWhatsappOptIn] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  useEffect(()=>{
    if(!isLiveBackend||!linkedBusinesses.length)return;
    const first=linkedBusinesses[0];
    if(first.business_kind==='independent'){
      const barber=state.barbers.find(b=>b.businessId===first.tenant_id&&b.isIndependent);
      if(barber){setSelectedTargetType('independent');setSelectedIndependentBarber(barber)}
    }else{
      const shop=state.barbershops.find(s=>s.id===first.tenant_id);
      if(shop){setSelectedTargetType('shop');setSelectedShop(shop)}
    }
  },[linkedBusinesses.map(x=>x.tenant_id).join(','),state.barbers,state.barbershops]);

  // Available barbers for this shop/service
  const availableBarbers = selectedTargetType === 'shop'
    ? state.barbers.filter(b => b.businessId === selectedShop?.id)
    : [selectedIndependentBarber];

  // Available services
  const availableServices = selectedTargetType === 'shop'
    ? state.services.filter(s => s.businessId === selectedShop?.id)
    : state.services.filter(s => s.businessId === selectedIndependentBarber?.businessId || s.barberId === selectedIndependentBarber?.id || s.barberIds.includes(selectedIndependentBarber?.id||''));

  // Time slots for the chosen day
  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  ];

  useEffect(() => {
    let active = true;
    const tenantId = selectedTargetType === 'shop' ? selectedShop?.id : selectedIndependentBarber?.businessId;

    if (isLiveBackend) {
      if (tenantId && selectedBarber?.id && selectedService?.id && selectedDate) {
        setIsLoadingSlots(true);
        getAvailabilitySlots(tenantId, selectedBarber.id, selectedService.id, selectedDate)
          .then((slots) => {
            if (!active) return;
            setAvailableSlots(slots);
            setSelectedTime((prev) => (slots.includes(prev) ? prev : (slots[0] || '')));
          })
          .catch(() => {
            if (!active) return;
            setAvailableSlots([]);
            setSelectedTime('');
          })
          .finally(() => {
            if (active) setIsLoadingSlots(false);
          });
      } else {
        setAvailableSlots([]);
        setSelectedTime('');
        setIsLoadingSlots(false);
      }
    } else {
      const today = getColombiaDateString();
      const isToday = selectedDate === today;
      const { hour: currentHour, minute: currentMin } = getColombiaTimeParts();

      const slots = timeSlots.filter((time) => {
        const isBooked = state.appointments.some(
          (a) =>
            a.barberId === selectedBarber?.id &&
            a.date === selectedDate &&
            a.startTime === time &&
            a.status !== 'cancelled'
        );
        if (isBooked) return false;
        if (isToday) {
          const [h, m] = time.split(':').map(Number);
          if (h < currentHour || (h === currentHour && m <= currentMin)) {
            return false;
          }
        }
        return true;
      });

      setAvailableSlots(slots);
      setSelectedTime((prev) => (slots.includes(prev) ? prev : (slots[0] || '')));
      setIsLoadingSlots(false);
    }

    return () => {
      active = false;
    };
  }, [
    selectedDate,
    selectedBarber?.id,
    selectedService?.id,
    selectedTargetType,
    selectedShop?.id,
    selectedIndependentBarber?.businessId,
    state.appointments,
  ]);

  const handleConfirmReservation = async () => {
    if (!selectedService || !selectedBarber) return;
    if(isLiveBackend){
      const tenantId=selectedTargetType==='shop'?selectedShop?.id:selectedIndependentBarber?.businessId;
      if(!tenantId){addToast('Selecciona un negocio o profesional disponible.','error');return;}
      const phone=customerProfile?.phone||currentUser?.phone?.trim()||window.prompt('Ingresa tu teléfono para confirmar la reserva:')?.trim();
      if(!phone){addToast('Necesitamos tu teléfono para la reserva.','error');return;}
      try{
        await addBooking(tenantId,{barberId:selectedBarber.id,
          serviceId:selectedService.id,date:selectedDate,startTime:selectedTime,
          customerName:customerProfile?.full_name||currentUser?.name||currentUser?.email||'Cliente',
          customerPhone:phone,whatsappOptIn,notes});
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

  const isSelectedDateToday = selectedDate === getColombiaDateString();
  const isPastTime = (time: string) => {
    if (!isSelectedDateToday) return false;
    const { hour, minute } = getColombiaTimeParts();
    const [h, m] = time.split(':').map(Number);
    return h < hour || (h === hour && m <= minute);
  };
  const handlePrevMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const calYear = calendarMonth.getFullYear();
  const calMonth = calendarMonth.getMonth();
  const calFirstDay = new Date(calYear, calMonth, 1);
  const calTotalDays = new Date(calYear, calMonth + 1, 0).getDate();
  const calMondayOffset = (calFirstDay.getDay() + 6) % 7;
  const colombiaToday = getColombiaDateString();

  const calendarMonthLabel = new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(calendarMonth);
  const capitalizedMonth = calendarMonthLabel.charAt(0).toUpperCase() + calendarMonthLabel.slice(1);

  const selectedDayFormatted = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(selectedDate + 'T12:00:00'));
  const capitalizedDayLabel = selectedDayFormatted.charAt(0).toUpperCase() + selectedDayFormatted.slice(1);

  const isValidSlotSelected = Boolean(
    selectedTime && availableSlots.includes(selectedTime) && !isPastTime(selectedTime)
  );

  return (
    <div className={`space-y-6 mx-auto ${step === 4 ? 'max-w-5xl' : 'max-w-3xl'} transition-all duration-300`}>
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
              {shopsToShow.map(shop => {
                const isSelected = selectedShop?.id === shop.id;
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
              {independentToShow.map(ind => {
                const isSelected = selectedIndependentBarber?.id === ind.id;
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

      {/* Step 4: Interactive Professional Calendar & Time Slots */}
      {step === 4 && (
        <div className="bg-[#121215] border border-white/[0.08] rounded-3xl p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)] space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

            {/* Left Column: Service & Barber Summary (Card 1) */}
            <div className="lg:col-span-4 bg-[#18181c] border border-white/[0.06] rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                {/* Shop info */}
                <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                  <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    {selectedShop?.logo ? (
                      <img src={selectedShop.logo} alt={selectedShop.name} className="w-full h-full object-cover" />
                    ) : (
                      <Store className="w-5 h-5 text-[var(--gold-primary)]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Lugar</span>
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                      {selectedTargetType === 'shop' ? selectedShop?.name : 'Estudio Independiente'}
                    </h4>
                  </div>
                </div>

                {/* Service info */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Servicio Seleccionado</span>
                  <h3 className="text-base font-extrabold text-white leading-tight">
                    {selectedService?.name || 'Servicio'}
                  </h3>
                  <div className="flex items-center justify-between pt-1">
                    <span className="px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-neutral-300 font-mono text-xs flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                      <span>{selectedService?.durationMinutes} min</span>
                    </span>
                    <span className="text-base font-extrabold text-[var(--gold-primary)] font-mono">
                      {formatCurrency(selectedService?.price || 0, currency)}
                    </span>
                  </div>
                </div>

                {/* Professional Attending */}
                <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Quién te atiende</span>
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-[var(--gold-primary)]/40 shadow-sm">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-800 ring-2 ring-[var(--gold-primary)]/40 flex items-center justify-center shrink-0">
                      {selectedBarber?.photo ? (
                        <img src={selectedBarber.photo} alt={selectedBarber.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-neutral-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-bold text-white truncate">{selectedBarber?.name}</h5>
                      <p className="text-[10px] text-neutral-400 flex items-center gap-1">
                        <Scissors className="w-3 h-3 text-[var(--gold-primary)]" />
                        <span>Especialista asignado</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                <label className="text-[11px] font-semibold text-neutral-300 block">
                  Notas especiales (opcional):
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ej. Mantener largo arriba, degradado medio..."
                  className="w-full bg-[#121214] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[var(--gold-primary)] resize-none"
                />
              </div>
            </div>

            {/* Center Column: Interactive Calendar (Card 2) */}
            <div className="lg:col-span-5 bg-[#18181c] border border-white/[0.06] rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
              <div>
                {/* Month header & navigation */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06]">
                  <h3 className="text-sm sm:text-base font-extrabold text-white capitalize">
                    {capitalizedMonth}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 flex items-center justify-center text-neutral-300 hover:text-white transition-all active:scale-95"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 flex items-center justify-center text-neutral-300 hover:text-white transition-all active:scale-95"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                    <span key={d} className="text-[11px] font-bold text-neutral-400 uppercase py-1">
                      {d}
                    </span>
                  ))}
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {Array.from({ length: calMondayOffset }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}

                  {Array.from({ length: calTotalDays }, (_, i) => {
                    const dayNum = i + 1;
                    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const isPast = dateStr < colombiaToday;
                    const isToday = dateStr === colombiaToday;
                    const isSelected = dateStr === selectedDate;

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        disabled={isPast}
                        onClick={() => setSelectedDate(dateStr)}
                        className={`aspect-square rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex flex-col items-center justify-center relative transition-all duration-200 active:scale-95 ${
                          isSelected
                            ? 'bg-[var(--gold-primary)] text-black shadow-[0_4px_16px_rgba(217,163,35,0.4)] ring-2 ring-[var(--gold-primary)] scale-105 z-10 font-extrabold'
                            : isPast
                            ? 'text-neutral-600 bg-transparent cursor-not-allowed opacity-30'
                            : 'bg-white/[0.03] hover:bg-white/[0.08] text-white border border-white/[0.06] hover:border-[var(--gold-primary)]/50'
                        }`}
                      >
                        <span>{dayNum}</span>
                        {isToday && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full absolute bottom-1.5 ${
                              isSelected ? 'bg-black' : 'bg-[var(--gold-primary)]'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-5 pt-3 border-t border-white/[0.06] text-[11px] text-neutral-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--gold-primary)]" />
                  <span>Hoy</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white/[0.15] border border-white/20" />
                  <span>Disponible</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[var(--gold-primary)] text-black" />
                  <span>Seleccionado</span>
                </div>
              </div>
            </div>

            {/* Right Column: Time Slots (Card 3) */}
            <div className="lg:col-span-3 bg-[#18181c] border border-white/[0.06] rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="pb-3 mb-3 border-b border-white/[0.06] flex items-center justify-between">
                  <div className="min-w-0 pr-1">
                    <h4 className="text-xs sm:text-sm font-extrabold text-white capitalize truncate">
                      {capitalizedDayLabel}
                    </h4>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {availableSlots.length} horarios libres
                    </span>
                  </div>
                  <div className="p-1 rounded-lg bg-white/[0.04] text-neutral-400 shrink-0">
                    <Clock className="w-4 h-4 text-[var(--gold-primary)]" />
                  </div>
                </div>

                {/* Slots scroll area */}
                <div className="max-h-[300px] sm:max-h-[340px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                  {isLoadingSlots ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-neutral-400">
                      <div className="w-5 h-5 border-2 border-[var(--gold-primary)] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium">Consultando turnos...</span>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex flex-col items-center text-center gap-2 py-8">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p className="font-semibold">Sin horarios disponibles</p>
                      <p className="text-[11px] text-neutral-400">
                        No hay turnos libres para esta fecha. Selecciona otro día en el calendario.
                      </p>
                    </div>
                  ) : (
                    availableSlots.map(time => {
                      const isPast = isPastTime(time);
                      const isSelected = selectedTime === time;

                      return (
                        <button
                          key={time}
                          type="button"
                          disabled={isPast}
                          onClick={() => setSelectedTime(time)}
                          className={`w-full py-2.5 px-3 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-between ${
                            isPast
                              ? 'bg-neutral-900/40 text-neutral-600 border border-neutral-900/60 cursor-not-allowed line-through'
                              : isSelected
                              ? 'bg-[var(--gold-primary)] text-black shadow-[0_4px_14px_rgba(217,163,35,0.35)] font-extrabold scale-[1.02]'
                              : 'bg-white/[0.03] hover:bg-white/[0.08] text-white border border-white/[0.08] hover:border-[var(--gold-primary)]/50'
                          }`}
                        >
                          <span>{time}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Slot helper indicator */}
              <div className="pt-3 mt-3 border-t border-white/[0.06] text-center">
                <span className="text-[11px] font-mono text-neutral-400">
                  {selectedTime ? (
                    <span className="text-white font-bold">
                      Seleccionado: <span className="text-[var(--gold-primary)]">{selectedTime}</span>
                    </span>
                  ) : (
                    'Elige una hora para continuar'
                  )}
                </span>
              </div>
            </div>

          </div>

          {/* Bottom Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
            <button
              onClick={() => setStep(selectedTargetType === 'independent' ? 2 : 3)}
              className="px-4 py-2.5 text-neutral-400 text-xs hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
            <button
              disabled={isLoadingSlots || !isValidSlotSelected}
              onClick={() => setStep(5)}
              className="px-7 py-3 rounded-xl bg-gradient-to-r from-[#f3c048] to-[#c9931b] text-black font-extrabold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 flex items-center gap-2 shadow-[0_4px_20px_rgba(217,163,35,0.3)] transition-all active:scale-95"
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

          {isLiveBackend && <label className="flex items-start gap-2 text-xs text-neutral-300">
            <input type="checkbox" checked={whatsappOptIn} onChange={event=>setWhatsappOptIn(event.target.checked)} className="mt-0.5" />
            <span>Autorizo recibir por WhatsApp la confirmación y el recordatorio de mi cita, así como avisos de inasistencia. Puedo reservar sin aceptar.</span>
          </label>}
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
