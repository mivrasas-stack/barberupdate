import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { barberStore } from '../../services/store';
import {isLiveBackend,addBooking,backendRequest,refreshLiveData,getAvailabilitySlots} from '../../services/liveBackend';
import {useCustomerLinks} from '../../services/useCustomerLinks';
import { formatCurrency } from '../../utils/formatters';
import {
  Calendar,
  Scissors,
  Clock,
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


function colombiaToday(){
 const parts=new Intl.DateTimeFormat('en-US',{
   timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(new Date());
 const v=(key:string)=>parts.find(p=>p.type===key)?.value||'00';
 return `${v('year')}-${v('month')}-${v('day')}`;
}

export const ClienteReservas: React.FC = () => {
  const { state, currentUser, currency, navigate, addToast } = useApp();
  const {items:linkedBusinesses,profile:customerProfile}=useCustomerLinks(currentUser?.id);
  const linkedIds=new Set(linkedBusinesses.map(link=>link.tenant_id));
  const shopsToShow=state.barbershops.filter(s=>s.businessKind!=='independent')
    .sort((a,b)=>Number(linkedIds.has(b.id))-Number(linkedIds.has(a.id)));

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Selections
  const [selectedShop, setSelectedShop] = useState<Barbershop>(() =>
    shopsToShow.find(shop=>state.services.some(service=>service.businessId===shop.id)
      &&state.barbers.some(barber=>barber.businessId===shop.id))||shopsToShow[0]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => colombiaToday());
  const [calendarMonth,setCalendarMonth]=useState(()=>{
    const [year,month]=colombiaToday().split('-').map(Number);
    return new Date(year,month-1,1);
  });
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [whatsappConsent,setWhatsappConsent]=useState(false);
  useEffect(()=>{
    if(!isLiveBackend||!linkedBusinesses.length)return;
    const linked=linkedBusinesses.find(x=>x.business_kind!=='independent');
    if(!linked)return;
    const shop=shopsToShow.find(s=>s.id===linked.tenant_id);
    if(shop)setSelectedShop(shop);
  },[linkedBusinesses.map(x=>x.tenant_id).join(','),state.barbershops]);

  // Only barberías comerciales: barbers are picked after choosing the service.
  const availableBarbers=state.barbers.filter(b=>b.businessId===selectedShop?.id && b.status==='active');
  const availableServices=state.services.filter(s=>s.businessId===selectedShop?.id && s.isActive);
  

  // Query the availability server for the selected service and barber. Offer
  // one start per clock hour, but never an instant invented by the browser.
  const [serverSlots,setServerSlots]=useState<string[]>([]);
  const [slotsBusy,setSlotsBusy]=useState(false);
  const [slotsError,setSlotsError]=useState('');
  useEffect(()=>{
    let alive=true;
    setSelectedTime('');
    setSlotsError('');
    if(!selectedShop?.id||!selectedService?.id||!selectedBarber?.id||!selectedDate){
      setServerSlots([]);return;
    }
    if(isLiveBackend){
      setSlotsBusy(true);
      getAvailabilitySlots(selectedShop.id,selectedBarber.id,selectedService.id,selectedDate)
        .then(items=>{if(alive)setServerSlots(items);})
        .catch(err=>{if(alive){setServerSlots([]);setSlotsError(err instanceof Error?err.message:'No se pudo consultar la agenda');}})
        .finally(()=>{if(alive)setSlotsBusy(false)});
    }else{
      // Demo mode only: respect business/barber hours and already occupied periods.
      const start=selectedShop.openingHours?.open||selectedBarber.workHours.start||'09:00';
      const end=selectedShop.openingHours?.close||selectedBarber.workHours.end||'18:00';
      const toMin=(t:string)=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
      const localNow=new Date();
      const possible:string[]=[];
      for(let m=toMin(start);m+selectedService.durationMinutes<=toMin(end);m+=60){
        const time=String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
        const booked=state.appointments.some(a=>a.barberId===selectedBarber.id&&a.date===selectedDate
          &&!['cancelled','no_show'].includes(a.status) &&
          m<toMin(a.endTime) && m+selectedService.durationMinutes>toMin(a.startTime));
        const unavailable=selectedDate===colombiaToday() && m<=
          Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Bogota',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(localNow).split(':')[0])*60+
          Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Bogota',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(localNow).split(':')[1]);
        if(!booked&&!unavailable)possible.push(time);
      }
      setServerSlots(possible);
    }
    return()=>{alive=false};
  },[selectedShop?.id,selectedService?.id,selectedService?.durationMinutes,selectedBarber?.id,selectedDate,state.appointments]);

  // This matches the request for hourly groups. The first truly available
  // instant within an hour is kept (e.g. 12:30 if 12:00 is occupied).
  const hourlySlots=serverSlots.filter((slot,i,arr)=>arr.findIndex(s=>s.slice(0,2)===slot.slice(0,2))===i);
  const calYear=calendarMonth.getFullYear();
  const calMonth=calendarMonth.getMonth();
  const totalDays=new Date(calYear,calMonth+1,0).getDate();
  const mondayOffset=(new Date(calYear,calMonth,1).getDay()+6)%7;
  const today=colombiaToday();
  const monthLabel=new Intl.DateTimeFormat('es-CO',{month:'long',year:'numeric'}).format(calendarMonth);
  const dayParts=selectedDate.split('-').map(Number);
  const dayLabel=new Intl.DateTimeFormat('es-CO',{weekday:'long',day:'numeric',month:'short'}).format(
    new Date(dayParts[0],dayParts[1]-1,dayParts[2],12));
  const firstShownMonth=today.slice(0,7);
  const prevDisabled=`${calYear}-${String(calMonth+1).padStart(2,'0')}`<=firstShownMonth;
  const nextDisabled=(calYear-new Date(today+'T12:00:00').getFullYear())*12+
    calMonth-new Date(today+'T12:00:00').getMonth()>=11;

  const handleConfirmReservation = async () => {
    if (!selectedService || !selectedBarber) return;
    if(isLiveBackend){
      const tenantId=selectedShop?.id;
      if(!tenantId){addToast('Selecciona un negocio o profesional disponible.','error');return;}
      const phone=customerProfile?.phone||currentUser?.phone?.trim()||window.prompt('Ingresa tu teléfono para confirmar la reserva:')?.trim();
      if(!phone){addToast('Necesitamos tu teléfono para la reserva.','error');return;}
      try{
        await addBooking(tenantId,{barberId:selectedBarber.id,
          serviceId:selectedService.id,date:selectedDate,startTime:selectedTime,
          customerName:customerProfile?.full_name||currentUser?.name||currentUser?.email||'Cliente',
          customerPhone:phone,notes});
        if(whatsappConsent){
          try{
            await backendRequest('/me/whatsapp/consent',{method:'POST',body:JSON.stringify({tenantId,phone,consent:true})});
            addToast('Autorización de avisos por WhatsApp registrada','success');
          }catch(err){
            addToast('La reserva se guardó, pero no se habilitaron los avisos de WhatsApp. Usa un número con indicativo de país.','info');
          }
        }
        await refreshLiveData();
        addToast('¡Reserva registrada en el backend!','success');
        setStep(6);
      }catch(error){addToast(error instanceof Error?error.message:'No se pudo reservar','error');}
      return;
    }

    const res = barberStore.createAppointment({
      businessId: selectedShop?.id,
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
          {step === 1 && 'Paso 1: Elige tu Barbería'}
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

      {/* Step 1: Choose a commercial barbershop; there is no independent-barber role. */}
      {step === 1 && (
        <div className="space-y-4">
          {shopsToShow.length ? shopsToShow.map(shop => {
            const isSelected=selectedShop?.id===shop.id;
            return (
              <button key={shop.id} onClick={()=>{setSelectedShop(shop);setSelectedBarber(null);setSelectedService(null);}}
                className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${isSelected?'border-[var(--gold-primary)] bg-[#1a1a1a] ring-1 ring-[var(--gold-primary)]/40':'border-[#262626] bg-[#141414] hover:border-neutral-700'}`}>
                <div className="flex items-center gap-3">
                  {shop.logo ? <img src={shop.logo} alt="" className="w-12 h-12 rounded-xl object-cover" /> :
                    <Store className="w-10 h-10 text-[var(--gold-primary)]" />}
                  <div>
                    <h3 className="text-sm font-bold text-white">{shop.name}</h3>
                    <p className="text-xs text-neutral-400 mt-1">{shop.city}{shop.address?' · '+shop.address:''}</p>
                    {shop.reviewsCount>0 && <p className="text-xs text-amber-400">{shop.rating.toFixed(1)} ★ ({shop.reviewsCount} reseñas)</p>}
                  </div>
                </div>
                {isSelected && <CheckCircle2 className="w-5 h-5 text-[var(--gold-primary)]" />}
              </button>
            );
          }) : <p className="text-neutral-400 text-sm">No hay barberías disponibles para reservar.</p>}
          <div className="flex justify-end pt-4">
            <button disabled={!selectedShop} onClick={()=>setStep(2)}
              className="px-6 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black font-bold text-xs disabled:opacity-40 hover:bg-[var(--gold-hover)] flex items-center gap-1.5">
              Continuar a Servicios <ChevronRight className="w-4 h-4" />
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
              onClick={() => setStep(3)}
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
                    {barber.photo?<img src={barber.photo} alt={barber.name} className="w-12 h-12 rounded-xl object-cover border border-neutral-700" />:
                      <div className="w-12 h-12 rounded-xl border border-neutral-700 bg-[#202020] flex items-center justify-center">
                        <User className="w-5 h-5 text-neutral-400"/>
                      </div>}
                    <div>
                      <h3 className="text-sm font-bold text-white">{barber.name}</h3>
                      <div className="flex items-center gap-1 text-amber-400 text-xs font-mono">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span>{barber.rating}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-400 line-clamp-2">{barber.bio||'Barbero profesional'}</p>
                  {(barber.experienceYears||0)>0&&<p className="text-[11px] text-neutral-400 mt-1">{barber.experienceYears} años de experiencia</p>}
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

      {/* Step 4: original three-column calendar, without independent-professional workflow. */}
      {step===4&&(
       <div className="rounded-3xl border border-white/[0.08] bg-[#121215] p-4 sm:p-6 shadow-2xl space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
         <section className="lg:col-span-4 rounded-2xl border border-white/[0.06] bg-[#18181c] p-4 sm:p-5 flex flex-col justify-between gap-5">
          <div className="space-y-4">
           <div className="flex items-center gap-3 border-b border-white/[0.08] pb-4">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center overflow-hidden">
             {selectedShop?.logo?<img src={selectedShop.logo} alt="" className="w-full h-full object-cover"/>:
              <Store className="w-5 h-5 text-[var(--gold-primary)]"/>}
            </div>
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Lugar</p>
             <h3 className="text-sm font-bold text-white truncate">{selectedShop?.name||'Barbería'}</h3>
            </div>
           </div>
           <div className="border-b border-white/[0.08] pb-4 space-y-2">
            <span className="uppercase text-[10px] font-bold text-neutral-400">Servicio seleccionado</span>
            <p className="text-sm font-extrabold text-white">{selectedService?.name||'Servicio'}</p>
            <div className="flex items-center justify-between gap-2">
             <span className="flex items-center gap-1.5 text-xs text-neutral-300 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1">
              <Clock className="w-3.5 h-3.5 text-[var(--gold-primary)]"/>{selectedService?.durationMinutes} min
             </span>
             <strong className="text-sm font-mono text-[var(--gold-primary)]">{formatCurrency(selectedService?.price||0,currency)}</strong>
            </div>
           </div>
           <div className="space-y-2">
            <span className="uppercase text-[10px] font-bold text-neutral-400">Quién te atiende</span>
            <div className="flex items-center gap-3 rounded-xl border border-[var(--gold-primary)]/40 bg-white/[0.03] p-2.5">
             {selectedBarber?.photo?<img src={selectedBarber.photo} alt="" className="w-10 h-10 rounded-full object-cover"/>:
              <div className="w-10 h-10 rounded-full border border-[var(--gold-primary)]/40 flex items-center justify-center">
               <User className="w-5 h-5 text-neutral-400"/></div>}
             <div><p className="text-xs font-bold text-white">{selectedBarber?.name||'Por definir'}</p>
              <p className="text-[10px] text-neutral-400 flex items-center gap-1"><Scissors className="w-3 h-3 text-[var(--gold-primary)]"/>Especialista asignado</p></div>
            </div>
           </div>
          </div>
          <div className="space-y-2 border-t border-white/[0.08] pt-4">
           <label htmlFor="booking-notes" className="text-[11px] font-semibold text-neutral-300">Notas especiales (opcional)</label>
           <textarea id="booking-notes" rows={2} value={notes} maxLength={2000} onChange={e=>setNotes(e.target.value)}
            placeholder="Ej. Mantener largo arriba, degradado medio..."
            className="w-full resize-none rounded-xl border border-white/10 bg-[#121214] px-3 py-2 text-xs text-white outline-none focus:border-[var(--gold-primary)]"/>
          </div>
         </section>
         <section className="lg:col-span-5 rounded-2xl border border-white/[0.06] bg-[#18181c] p-4 sm:p-5 flex flex-col justify-between gap-5">
          <div>
           <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
            <h3 className="capitalize text-sm sm:text-base font-extrabold text-white">{monthLabel}</h3>
            <div className="flex items-center gap-1">
             <button type="button" aria-label="Mes anterior" disabled={prevDisabled}
              onClick={()=>setCalendarMonth(new Date(calYear,calMonth-1,1))}
              className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.05] text-neutral-200 flex items-center justify-center disabled:opacity-30">
              <ChevronLeft className="w-4 h-4"/></button>
             <button type="button" aria-label="Mes siguiente" disabled={nextDisabled}
              onClick={()=>setCalendarMonth(new Date(calYear,calMonth+1,1))}
              className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.05] text-neutral-200 flex items-center justify-center disabled:opacity-30">
              <ChevronRight className="w-4 h-4"/></button>
            </div>
           </div>
           <div className="grid grid-cols-7 text-center gap-1 mb-2">
            {['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'].map(d=><span key={d} className="text-[10px] font-bold text-neutral-400 py-1">{d}</span>)}
           </div>
           <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {Array.from({length:mondayOffset},(_,i)=><div key={'empty-'+i} className="aspect-square"/>)}
            {Array.from({length:totalDays},(_,i)=>{
             const d=i+1,iso=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
             const past=iso<today,selected=iso===selectedDate,todayDate=iso===today;
             return <button key={iso} type="button" disabled={past}
              aria-label={'Seleccionar '+iso} aria-pressed={selected} onClick={()=>setSelectedDate(iso)}
              className={`aspect-square rounded-xl sm:rounded-2xl relative text-xs sm:text-sm font-extrabold transition-transform hover:scale-[1.04] disabled:hover:scale-100 ${selected?
                'bg-[var(--gold-primary)] text-black shadow-[0_4px_16px_rgba(217,163,35,0.4)]':
                past?'opacity-25 text-neutral-500':'border border-white/[0.06] bg-white/[0.04] text-white hover:border-[var(--gold-primary)]/50'}`}>
              {d}{todayDate&&<span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${selected?'bg-black':'bg-[var(--gold-primary)]'}`}/>}
             </button>;
            })}
           </div>
          </div>
          <div className="flex justify-center gap-4 border-t border-white/[0.08] pt-4 text-[10px] text-neutral-400">
           <span>🟡 Hoy</span><span>◯ Disponible</span><span>🟨 Seleccionado</span>
          </div>
         </section>
         <section className="lg:col-span-3 rounded-2xl border border-white/[0.06] bg-[#18181c] p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div>
           <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-3">
            <div><h3 className="text-sm font-extrabold text-white capitalize">{dayLabel}</h3>
             <p className="text-[10px] text-neutral-400 mt-1">{slotsBusy?'Consultando...':hourlySlots.length+' horarios libres'}</p></div>
            <Clock className="w-4 h-4 text-[var(--gold-primary)]"/>
           </div>
           <div className="max-h-[350px] overflow-y-auto pr-1 space-y-2" aria-label="Horarios disponibles por hora">
            {slotsBusy?<p role="status" className="text-xs text-neutral-400 py-5">Consultando horarios reales...</p>:
             slotsError?<p role="alert" className="text-xs text-red-300 py-5">{slotsError}</p>:
             hourlySlots.length===0?<p className="text-xs text-neutral-400 py-5">Sin turnos libres para este día. Prueba otra fecha.</p>:
             hourlySlots.map(time=><button type="button" key={time} aria-pressed={time===selectedTime}
              onClick={()=>setSelectedTime(time)}
              className={`w-full rounded-xl border px-3 py-3 text-left font-mono text-xs font-semibold transition-colors ${time===selectedTime?
               'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-black':'border-[#353539] bg-[#202024] text-neutral-200 hover:border-[var(--gold-primary)]'}`}>
              {time}{time===selectedTime&&<CheckCircle2 className="w-4 h-4 float-right"/>}
             </button>)
            }
           </div>
          </div>
          <div className="border-t border-white/[0.08] pt-3 text-center text-[10px] font-bold text-neutral-400">
           Seleccionado: <span className="font-mono text-[var(--gold-primary)]">{selectedTime||'Ninguno'}</span>
          </div>
         </section>
        </div>
        {isLiveBackend&&<label className="flex items-start gap-3 rounded-xl border border-neutral-700 p-3 sm:p-4 text-xs text-neutral-300">
         <input type="checkbox" checked={whatsappConsent} onChange={e=>setWhatsappConsent(e.target.checked)} className="mt-0.5 accent-amber-400"/>
         <span>Autorizo a esta barbería a enviarme por WhatsApp confirmaciones, recordatorios y cambios de esta cita. Es opcional y puedo revocar mi autorización.</span>
        </label>}
        <div className="flex justify-between items-center border-t border-white/[0.08] pt-4 gap-3">
         <button type="button" onClick={()=>setStep(3)} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white">
          <ChevronLeft className="w-4 h-4"/>Atrás
         </button>
         <button type="button" disabled={!selectedTime||slotsBusy||!!slotsError||!hourlySlots.includes(selectedTime)}
          onClick={()=>setStep(5)}
          className="flex items-center gap-2 rounded-xl bg-[var(--gold-primary)] px-6 py-3 text-xs font-extrabold text-black disabled:opacity-40">
          Revisar Resumen <ChevronRight className="w-4 h-4"/>
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
                {selectedShop?.name || 'Barbería'}
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
