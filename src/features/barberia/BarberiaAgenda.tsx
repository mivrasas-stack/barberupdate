import React, {useEffect,useState} from 'react';
import {useRollingAgendaDate,rollingAgendaDays,shiftAgendaDate} from '../../utils/agendaDates';
import { useApp } from '../../context/AppContext';
import { barberStore } from '../../services/store';
import {isLiveBackend,addBooking,updateBooking,refreshLiveData} from '../../services/liveBackend';
import { formatCurrency, formatTime } from '../../utils/formatters';
import {CopAmountInput} from '../../components/common/CopAmountInput';
import { Appointment, AppointmentStatus, PaymentMethod } from '../../types';
import {
  Calendar,
  Clock,
  Plus,
  UserPlus,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Play,
  Check,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export const BarberiaAgenda: React.FC = () => {
  const { currentShop, currentUser, state, currency, addToast } = useApp();
  const [viewType, setViewType] = useState<'day' | 'week' | 'list'>('week');
  const {today,selectedDate,setSelectedDate,goToday}=useRollingAgendaDate();
  const [inspectingId,setInspectingId]=useState<string|null>(null);
  const [statusBusy,setStatusBusy]=useState(false);
  const [selectedBarberId, setSelectedBarberId] = useState<string>(
    currentUser?.role === 'barber_employee' && currentUser?.barberId ? currentUser.barberId : 'all'
  );
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modals
  const [isNewAptModalOpen, setIsNewAptModalOpen] = useState(false);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [completingApt, setCompletingApt] = useState<Appointment | null>(null);
  const [paymentMethodForComplete, setPaymentMethodForComplete] = useState<PaymentMethod>('cash');

  // Form states for New Appointment
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newServiceId, setNewServiceId] = useState(state.services[0]?.id || '');
  const [newBarberId, setNewBarberId] = useState(state.barbers[0]?.id || '');
  const [newStartTime, setNewStartTime] = useState('11:00');
  const [newDiscount, setNewDiscount] = useState<number|null>(null);
  const [newNotes, setNewNotes] = useState('');

  // Form states for Walk-In
  const [walkInCustName, setWalkInCustName] = useState('');
  const [walkInCustPhone, setWalkInCustPhone] = useState('');
  const [walkInServiceId, setWalkInServiceId] = useState(state.services[0]?.id || '');
  const [walkInBarberId, setWalkInBarberId] = useState(state.barbers[0]?.id || '');

  const shopId = currentShop?.id || 'shop-1';
  const barbers = state.barbers.filter(b => b.businessId === shopId);
  const services = state.services.filter(s => s.businessId === shopId);

  // Seven consecutive days starting at today, not a fixed Monday-to-Sunday demo week.
  const weekDays=rollingAgendaDays(selectedDate,today);

  // Refresh the authoritative backend when crossing midnight in Colombia.
  useEffect(()=>{if(isLiveBackend)void refreshLiveData().catch(()=>{});},[today]);

  // Filtered appointments
  const appointments = state.appointments.filter(a => {
    const matchesShop = a.businessId === shopId;
    let matchesDate = true;
    if (viewType === 'day') {
      matchesDate = a.date === selectedDate;
    } else if (viewType === 'week') {
      matchesDate = weekDays.some(w => w.date === a.date);
    }
    const matchesBarber = selectedBarberId === 'all' || a.barberId === selectedBarberId;
    const matchesStatus = selectedStatus === 'all' || a.status === selectedStatus;
    return matchesShop && matchesDate && matchesBarber && matchesStatus;
  });

  // Hours of the day
  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    '18:00', '18:30', '19:00', '19:30',
  ];

  const gridHours = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
    '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
  ];

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    const service = state.services.find(s => s.id === newServiceId);
    if (!service) return;
    if(isLiveBackend){
      try{
        await addBooking(shopId,{barberId:newBarberId,serviceId:service.id,date:selectedDate,
          startTime:newStartTime,customerName:newCustName,customerPhone:newCustPhone,notes:newNotes});
        await refreshLiveData();
        addToast('Reserva creada en BarberOS','success');
        setIsNewAptModalOpen(false);setNewCustName('');setNewCustPhone('');setNewDiscount(null);
      }catch(error){addToast(error instanceof Error?error.message:'Error al reservar','error');}
      return;
    }

    const res = barberStore.createAppointment({
      businessId: shopId,
      barberId: newBarberId,
      customerId: `cust-${Date.now()}`,
      customerName: newCustName,
      customerPhone: newCustPhone,
      serviceId: service.id,
      serviceName: service.name,
      date: selectedDate,
      startTime: newStartTime,
      endTime: '12:00',
      durationMinutes: service.durationMinutes,
      price: service.price,
      discount: newDiscount??0,
      finalPrice: Math.max(0, service.price - (newDiscount??0)),
      status: 'confirmed',
      notes: newNotes,
    });

    if (!res.success) {
      addToast(res.error || 'Error al agendar cita', 'error');
      return;
    }

    addToast(`Cita agendada para ${newCustName}`, 'success');
    setIsNewAptModalOpen(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewDiscount(null);
  };

  const handleRegisterWalkIn = (e: React.FormEvent) => {
    e.preventDefault();
    if(isLiveBackend){addToast('Las llegadas sin cita requieren una reserva con horario disponible en el backend.', 'info');return;}
    const apt = barberStore.registerWalkIn(
      walkInCustName,
      walkInCustPhone,
      walkInBarberId,
      walkInServiceId,
      shopId
    );
    addToast(`Cliente ${apt.customerName} registrado en cola de espera`, 'success');
    setIsWalkInModalOpen(false);
    setWalkInCustName('');
    setWalkInCustPhone('');
  };

  const inspectingApt=state.appointments.find(a=>a.id===inspectingId&&a.businessId===shopId)||null;
  const isAbsentEligible=(apt:Appointment)=>
    Date.parse(apt.date+'T'+apt.startTime+':00-05:00')<=Date.now()-15*60_000;
  const handleStatus=async(apt:Appointment,status:AppointmentStatus)=>{
    if(status==='no_show'&&!isAbsentEligible(apt)){
      addToast('Espera 15 minutos desde la hora de la cita antes de registrar ausencia.','error');return;
    }
    if((status==='cancelled'||status==='no_show')&&
      !window.confirm(status==='cancelled'
        ?'¿Cancelar esta cita? El horario volverá a estar disponible cuando aún sea futuro.'
        :'¿Confirmas que el cliente no asistió? Se liberará cualquier franja aún reservable.'))return;
    if(statusBusy)return;
    setStatusBusy(true);
    try{
      if(isLiveBackend){
        await updateBooking(shopId,apt.id,status);
        await refreshLiveData();
      }else barberStore.updateAppointmentStatus(apt.id,status);
      addToast(status==='in_service'?'Corte iniciado':
        status==='no_show'?'Ausencia registrada':
        status==='cancelled'?'Cita cancelada':status==='waiting'?'Llegada registrada':
        status==='confirmed'?'Reserva confirmada':'Estado actualizado','success');
      setInspectingId(null);
    }catch(error){addToast(error instanceof Error?error.message:'Error al actualizar la cita','error');}
    finally{setStatusBusy(false);}
  };

  const handleConfirmCompletion = () => {
    if (!completingApt) return;
    if(isLiveBackend){
      if(completingApt.status!=='in_service'){addToast('Primero marca la cita en servicio.','error');return;}
      void updateBooking(shopId,completingApt.id,'completed').then(refreshLiveData)
        .then(()=>{addToast('Servicio finalizado. Registra el pago en caja si corresponde.','success');setCompletingApt(null);})
        .catch(e=>addToast(e instanceof Error?e.message:'No se pudo finalizar','error'));
      return;
    }
    barberStore.updateAppointmentStatus(completingApt.id, 'completed', paymentMethodForComplete);
    addToast(`Servicio finalizado y cobrado (${paymentMethodForComplete.toUpperCase()})`, 'success');
    setCompletingApt(null);
  };


  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Control de Flujo
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Agenda Global & Turnos</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Programación de citas, tiempos por barbero y gestión de llegadas sin cita (Walk-ins)
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Walk-in Button */}
          <button
            onClick={() => setIsWalkInModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-500/25 transition-all shadow-md"
          >
            <UserPlus className="w-4 h-4 text-amber-400" />
            <span>Registrar Llegada Sin Cita</span>
          </button>

          {/* New Appointment Button */}
          <button
            onClick={() => setIsNewAptModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black text-xs font-bold hover:bg-[var(--gold-hover)] transition-all shadow-lg shadow-[var(--gold-primary)]/10"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Cita</span>
          </button>
        </div>
      </div>

      {/* Date Navigation & Filters Bar */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Date Navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedDate(shiftAgendaDate(selectedDate,-1));
            }}
            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-[#181818] border border-[#2a2a2a] rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-[var(--gold-primary)]"
          />

          <button
            onClick={() => {
              setSelectedDate(shiftAgendaDate(selectedDate,1));
            }}
            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={goToday}
            className="px-2.5 py-1.5 rounded-lg bg-[#202020] text-neutral-300 text-[11px] font-semibold hover:text-white"
          >
            Hoy
          </button>
        </div>

        {/* View and Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Barber filter pills */}
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setSelectedBarberId('all')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedBarberId === 'all'
                  ? 'bg-[var(--gold-primary)] text-black font-bold shadow'
                  : 'bg-[#181818] border border-[#2a2a2a] text-neutral-400 hover:text-white'
              }`}
            >
              Todos los barberos
            </button>
            {barbers.map(b => (
              <button
                key={b.id}
                onClick={() => setSelectedBarberId(b.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  selectedBarberId === b.id
                    ? 'bg-[var(--gold-primary)] text-black border-[var(--gold-primary)] font-bold shadow'
                    : 'bg-[#181818] border-[#2a2a2a] text-neutral-400 hover:text-white hover:border-neutral-700'
                }`}
              >
                <img src={b.photo} alt={b.name} className="w-4 h-4 rounded-full object-cover" />
                <span>{b.name}</span>
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="bg-[#181818] border border-[#2a2a2a] rounded-xl px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-[var(--gold-primary)] cursor-pointer"
          >
            <option value="all">Todos los estados</option>
            <option value="waiting">En espera (Cola)</option>
            <option value="in_service">En servicio</option>
            <option value="confirmed">Confirmadas</option>
            <option value="completed">Finalizadas</option>
            <option value="cancelled">Canceladas</option>
            <option value="no_show">No asistió</option>
          </select>

          {/* View switcher */}
          <div className="flex items-center gap-1 p-1 bg-black/40 backdrop-blur-md border border-white/[0.08] rounded-full text-xs shadow-inner">
            <button
              onClick={() => setViewType('week')}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all duration-200 cursor-pointer active:scale-95 ${
                viewType === 'week' ? 'bg-gradient-to-b from-[#f3c048] to-[#c9931b] text-black shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setViewType('day')}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all duration-200 cursor-pointer active:scale-95 ${
                viewType === 'day' ? 'bg-gradient-to-b from-[#f3c048] to-[#c9931b] text-black shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Día
            </button>
            <button
              onClick={() => setViewType('list')}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all duration-200 cursor-pointer active:scale-95 ${
                viewType === 'list' ? 'bg-gradient-to-b from-[#f3c048] to-[#c9931b] text-black shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Lista
            </button>
          </div>
        </div>
      </div>

      {/* Agenda Content */}
      {viewType === 'week' ? (
        <div className="bg-[#141418]/90 backdrop-blur-2xl border border-white/[0.08] rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)] animate-apple-enter">
          <div className="overflow-x-auto">
            <div className="min-w-[850px]">
              {/* Header Row: 7 Days of the Week */}
              <div className="grid grid-cols-8 border-b border-white/[0.08] bg-black/40 backdrop-blur-md sticky top-0 z-20">
                <div className="p-3.5 text-center border-r border-white/[0.08] text-neutral-500 text-[10px] font-mono uppercase font-bold flex items-center justify-center">
                  Hora
                </div>

                {weekDays.map(day => {
                  const dayAptsCount = appointments.filter(a => a.date === day.date && !['cancelled','no_show'].includes(a.status)).length;
                  return (
                    <div
                      key={day.date}
                      className={`p-3 text-center border-r border-white/[0.08] last:border-r-0 transition-colors ${
                        day.isToday ? 'bg-[var(--gold-primary)]/[0.08] ring-1 ring-inset ring-[var(--gold-primary)]/30' : ''
                      }`}
                    >
                      <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                        {day.dayName}
                      </div>
                      <div className="flex items-center justify-center gap-1.5 mt-0.5">
                        <span className={`text-base font-extrabold font-mono ${day.isToday ? 'text-[var(--gold-primary)]' : 'text-white'}`}>
                          {day.dayNumber}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-medium">{day.monthName}</span>
                      </div>
                      <div className="mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                          dayAptsCount > 0
                            ? 'bg-white/[0.08] text-[var(--gold-primary)] font-bold border border-[var(--gold-primary)]/20'
                            : 'text-neutral-500'
                        }`}>
                          {dayAptsCount} {dayAptsCount === 1 ? 'cita' : 'citas'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grid Body */}
              <div className="divide-y divide-white/[0.05]">
                {gridHours.map(hour => {
                  const hourPrefix = hour.split(':')[0];

                  return (
                    <div key={hour} className="grid grid-cols-8 min-h-[92px]">
                      <div className="p-2.5 text-center border-r border-white/[0.08] bg-black/25 text-xs font-mono font-bold text-neutral-400 flex items-start justify-center pt-3">
                        {hour}
                      </div>

                      {weekDays.map(day => {
                        const aptsInSlot = appointments.filter(a => {
                          if (a.date !== day.date) return false;
                          const aptHour = a.startTime.split(':')[0];
                          return aptHour === hourPrefix;
                        });

                        return (
                          <div
                            key={day.date}
                            className={`p-1.5 border-r border-white/[0.08] last:border-r-0 relative group transition-colors ${
                              day.isToday ? 'bg-[var(--gold-primary)]/[0.02]' : 'hover:bg-white/[0.02]'
                            }`}
                          >
                            {aptsInSlot.length > 0 ? (
                              <div className="space-y-1.5">
                                {aptsInSlot.map(apt => {
                                  const barber = state.barbers.find(b => b.id === apt.barberId);
                                  let badgeColor = 'bg-white/[0.05] border-white/[0.1] text-white hover:border-white/30';
                                  if (apt.status === 'completed') {
                                    badgeColor = 'bg-emerald-500/[0.1] border-emerald-500/35 text-emerald-300 hover:border-emerald-500/60 shadow-[0_4px_16px_rgba(16,185,129,0.15)]';
                                  } else if (apt.status === 'in_service') {
                                    badgeColor = 'bg-[var(--gold-primary)]/[0.15] border-[var(--gold-primary)]/80 text-[var(--gold-primary)] animate-pulse shadow-[0_4px_20px_rgba(217,163,35,0.25)]';
                                  } else if (apt.status === 'waiting') {
                                    badgeColor = 'bg-amber-500/[0.12] border-amber-500/40 text-amber-300 hover:border-amber-500/60 shadow-[0_4px_16px_rgba(245,158,11,0.15)]';
                                  } else if (apt.status === 'confirmed') {
                                    badgeColor = 'bg-blue-500/[0.1] border-blue-500/35 text-blue-200 hover:border-blue-500/60 shadow-[0_4px_16px_rgba(59,130,246,0.15)]';
                                  }

                                  return (
                                    <div
                                      key={apt.id}
                                      onClick={() => setInspectingId(apt.id)}
                                      className={`p-2.5 rounded-2xl border ${badgeColor} backdrop-blur-md shadow-md transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] cursor-pointer text-left group/card`}
                                    >
                                      <div className="flex items-center justify-between text-[10px] font-mono">
                                        <span className="font-extrabold">{apt.startTime}</span>
                                        <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded-full bg-black/30 backdrop-blur-sm border border-white/[0.05]">
                                          {apt.status === 'in_service' ? 'En corte' : apt.status === 'waiting' ? 'En espera' : apt.status}
                                        </span>
                                      </div>
                                      <div className="text-xs font-bold text-white truncate mt-1 group-hover/card:text-[var(--gold-primary)] transition-colors">
                                        {apt.customerName}
                                      </div>
                                      <div className="text-[10px] text-neutral-300 truncate">
                                        {apt.serviceName} · <span className="font-semibold text-white">{barber?.name?.split(' ')[0]}</span>
                                      </div>
                                      <div className="text-[11px] font-mono font-extrabold text-[var(--gold-primary)] mt-1.5">
                                        {formatCurrency(apt.finalPrice, currency)}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedDate(day.date);
                                  setNewStartTime(hour);
                                  setIsNewAptModalOpen(true);
                                }}
                                className="w-full h-full min-h-[72px] rounded-xl border border-transparent hover:border-dashed hover:border-white/20 hover:bg-white/[0.03] flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-all duration-200 text-neutral-400 hover:text-[var(--gold-primary)] cursor-pointer active:scale-95"
                                title={`Agendar cita el ${day.dayName} a las ${hour}`}
                              >
                                <Plus className="w-4 h-4" />
                                <span className="text-[10px] font-semibold mt-0.5">+ Agendar</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : viewType === 'day' ? (
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 overflow-hidden shadow-xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-4 flex items-center justify-between">
            <span>Franjas Horarias del Día</span>
            <span className="text-[11px] text-[var(--gold-primary)] font-mono">{appointments.length} citas programadas</span>
          </div>

          <div className="space-y-2">
            {timeSlots.map(time => {
              const aptsAtTime = appointments.filter(a => a.startTime === time);

              return (
                <div
                  key={time}
                  className="flex items-start gap-4 p-2.5 rounded-xl border border-neutral-800/80 bg-[#171717] hover:border-neutral-700 transition-colors"
                >
                  {/* Time label */}
                  <div className="w-16 font-mono font-bold text-neutral-300 text-xs pt-1 shrink-0">
                    {time}
                  </div>

                  {/* Appointments at this slot */}
                  <div className="flex-1 space-y-2">
                    {aptsAtTime.length === 0 ? (
                      <div className="text-[11px] text-neutral-600 italic py-1 flex items-center justify-between">
                        <span>Horario disponible</span>
                        <button
                          onClick={() => {
                            setNewStartTime(time);
                            setIsNewAptModalOpen(true);
                          }}
                          className="opacity-0 hover:opacity-100 text-[10px] text-[var(--gold-primary)] font-bold px-2 py-0.5 rounded bg-[var(--gold-primary)]/10"
                        >
                          + Agendar aquí
                        </button>
                      </div>
                    ) : (
                      aptsAtTime.map(apt => {
                        const barber = state.barbers.find(b => b.id === apt.barberId);

                        let cardBg = 'bg-[#1f1f1f] border-neutral-700';
                        if (apt.status === 'in_service') cardBg = 'bg-[var(--gold-primary)]/10 border-[var(--gold-primary)]/50';
                        if (apt.status === 'waiting') cardBg = 'bg-amber-500/10 border-amber-500/40';
                        if (apt.status === 'completed') cardBg = 'bg-emerald-500/5 border-emerald-500/30';
                        if (apt.status === 'cancelled') cardBg = 'bg-red-500/5 border-red-500/20 opacity-60';

                        return (
                          <div
                            key={apt.id}
                            className={`p-3 rounded-xl border ${cardBg} flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs`}
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={barber?.photo}
                                alt={barber?.name}
                                className="w-8 h-8 rounded-full object-cover shrink-0"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white text-sm">{apt.customerName}</span>
                                  {apt.isWalkIn && (
                                    <span className="text-[10px] text-amber-400 font-bold px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                                      Llegada Sin Cita
                                    </span>
                                  )}
                                  <span className="text-[10px] text-neutral-400 font-mono">({apt.customerPhone})</span>
                                </div>
                                <div className="text-[11px] text-neutral-300 mt-0.5">
                                  {apt.serviceName} · <strong className="text-white">{barber?.name}</strong> · {apt.durationMinutes} min
                                </div>
                                {apt.notes && <div className="text-[10px] text-neutral-500 italic mt-0.5">"{apt.notes}"</div>}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-center">
                              <div className="text-right">
                                <span className="font-mono font-bold text-white text-sm">
                                  {formatCurrency(apt.finalPrice, currency)}
                                </span>
                              </div>

                              {/* Status Action Buttons */}
                              {apt.status === 'waiting' && (
                                <button
                                  onClick={() => setInspectingId(apt.id)}
                                  className="px-3 py-1.5 rounded-lg bg-[var(--gold-primary)] text-black font-bold text-xs flex items-center gap-1 shadow-sm"
                                  title="Iniciar corte en la silla"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                  <span>Ver cita</span>
                                </button>
                              )}

                              {apt.status === 'in_service' && (
                                <button
                                  onClick={() => handleAdvanceStatus(apt)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-bold text-xs flex items-center gap-1 shadow-sm"
                                  title="Finalizar corte y registrar cobro en caja"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Ver cita</span>
                                </button>
                              )}

                              {apt.status === 'confirmed' && (
                                <button
                                  onClick={() => handleAdvanceStatus(apt)}
                                  className="px-3 py-1.5 rounded-lg bg-[#282828] hover:bg-[var(--gold-primary)] hover:text-black font-semibold text-xs text-white"
                                >
                                  Finalizar
                                </button>
                              )}

                              {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                                <button
                                  onClick={() => setInspectingId(apt.id)}
                                  className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400"
                                  title="Cancelar cita"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {apt.status === 'completed' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Completada
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List View */
        <div className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#262626] bg-[#181818] text-neutral-400">
                <th className="py-3 px-4 font-semibold">Hora / Fecha</th>
                <th className="py-3 px-4 font-semibold">Cliente</th>
                <th className="py-3 px-4 font-semibold">Servicio</th>
                <th className="py-3 px-4 font-semibold">Barbero</th>
                <th className="py-3 px-4 font-semibold">Importe</th>
                <th className="py-3 px-4 font-semibold">Estado</th>
                <th className="py-3 px-4 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e]">
              {appointments.map(apt => {
                const barber = state.barbers.find(b => b.id === apt.barberId);
                return (
                  <tr key={apt.id} className="hover:bg-[#181818] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {apt.startTime} <span className="text-neutral-500 font-normal">({apt.date})</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{apt.customerName}</div>
                      <div className="text-[11px] text-neutral-500">{apt.customerPhone}</div>
                    </td>
                    <td className="py-3 px-4 text-neutral-300">{apt.serviceName}</td>
                    <td className="py-3 px-4 text-neutral-300">{barber?.name}</td>
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {formatCurrency(apt.finalPrice, currency)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-300">
                        {apt.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {apt.status !== 'completed' && apt.status !== 'cancelled' ? (
                        <button
                          onClick={() => handleAdvanceStatus(apt)}
                          className="px-2.5 py-1 rounded bg-[var(--gold-primary)] text-black font-bold text-xs"
                        >
                          Ver detalle
                        </button>
                      ) : (
                        <span className="text-neutral-500 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* A click must never mutate a booking without an explicit action. */}
      {inspectingApt&&(
       <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
        <section role="dialog" aria-modal="true" aria-labelledby="agenda-detail-heading"
         className="w-full max-w-lg overflow-y-auto max-h-[90vh] rounded-3xl border border-[#343434] bg-[#151515] p-5 sm:p-6 shadow-2xl">
         <div className="flex items-center justify-between border-b border-[#303030] pb-4">
          <h2 id="agenda-detail-heading" className="text-lg font-bold text-white">Detalle de la cita</h2>
          <button type="button" aria-label="Cerrar detalle" onClick={()=>setInspectingId(null)} className="p-2 text-neutral-400 hover:text-white"><X className="w-5 h-5"/></button>
         </div>
         <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-5 text-xs">
          {([
           ['Cliente',inspectingApt.customerName],
           ['Teléfono',inspectingApt.customerPhone||'No registrado'],
           ['Servicio',inspectingApt.serviceName],
           ['Barbero',state.barbers.find(b=>b.id===inspectingApt.barberId)?.name||'Sin asignar'],
           ['Fecha',inspectingApt.date],
           ['Hora',inspectingApt.startTime+' – '+inspectingApt.endTime],
           ['Duración',inspectingApt.durationMinutes+' minutos'],
           ['Estado',inspectingApt.status],
           ['Valor',formatCurrency(inspectingApt.finalPrice,currency)]
          ] as [string,string][]).map(([label,value])=>
           <div key={label}><dt className="text-neutral-500">{label}</dt><dd className="mt-1 font-semibold text-white break-words">{value}</dd></div>
          )}
          {inspectingApt.notes&&<div className="sm:col-span-2"><dt className="text-neutral-500">Notas del cliente</dt><dd className="mt-1 text-neutral-200 whitespace-pre-wrap">{inspectingApt.notes}</dd></div>}
         </dl>
         <div className="space-y-3 border-t border-[#303030] pt-4">
          {inspectingApt.status==='pending'&&<button disabled={statusBusy} onClick={()=>void handleStatus(inspectingApt,'confirmed')} className="w-full rounded-xl bg-[var(--gold-primary)] px-4 py-3 text-xs font-bold text-black disabled:opacity-50">Confirmar cita</button>}
          {inspectingApt.status==='confirmed'&&<button disabled={statusBusy} onClick={()=>void handleStatus(inspectingApt,'waiting')} className="w-full rounded-xl border border-amber-500/50 px-4 py-3 text-xs font-bold text-amber-300 disabled:opacity-50">Registrar llegada del cliente</button>}
          {['confirmed','waiting'].includes(inspectingApt.status)&&<button disabled={statusBusy} onClick={()=>void handleStatus(inspectingApt,'in_service')} className="w-full rounded-xl bg-[var(--gold-primary)] px-4 py-3 text-xs font-bold text-black disabled:opacity-50"><Play className="mr-1 inline h-4 w-4"/>Iniciar corte</button>}
          {inspectingApt.status==='in_service'&&<button disabled={statusBusy} onClick={()=>{setCompletingApt(inspectingApt);setInspectingId(null)}} className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-xs font-bold text-black disabled:opacity-50">Finalizar servicio</button>}
          {['pending','confirmed','waiting'].includes(inspectingApt.status)&&(
           <div className="flex flex-col sm:flex-row gap-2">
            {['confirmed','waiting'].includes(inspectingApt.status)&&
             <button disabled={statusBusy||!isAbsentEligible(inspectingApt)} onClick={()=>void handleStatus(inspectingApt,'no_show')}
              title={!isAbsentEligible(inspectingApt)?'Disponible 15 minutos después de la hora reservada':''}
              className="flex-1 rounded-xl border border-orange-500/40 p-3 text-xs font-bold text-orange-300 disabled:opacity-35">El cliente no asistió</button>}
            <button disabled={statusBusy} onClick={()=>void handleStatus(inspectingApt,'cancelled')}
             className="flex-1 rounded-xl border border-rose-500/40 p-3 text-xs font-bold text-rose-300 disabled:opacity-50">Cancelar cita y liberar horario</button>
           </div>
          )}
          {['completed','cancelled','no_show'].includes(inspectingApt.status)&&
           <p className="text-xs text-neutral-400">Esta cita ya está cerrada. Su historial se conserva.</p>}
          <p className="text-[11px] text-neutral-500">Al cancelar o marcar ausencia, PostgreSQL libera el bloqueo de ese horario. Solo los turnos futuros pueden reservarse de nuevo.</p>
         </div>
        </section>
       </div>
      )}

      {/* Modal: Nueva Cita Programada */}
      {isNewAptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <h3 className="text-base font-bold text-white">Programar Nueva Cita</h3>
              <button
                onClick={() => setIsNewAptModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="py-4 space-y-3 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Nombre del Cliente</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  placeholder="Ej. Juan Sebastián Gómez"
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Teléfono Móvil (WhatsApp)</label>
                <input
                  type="text"
                  required
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                  placeholder="+57 300 123 4567"
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Servicio</label>
                  <select
                    value={newServiceId}
                    onChange={e => setNewServiceId(e.target.value)}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white cursor-pointer"
                  >
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({formatCurrency(s.price, currency)})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-neutral-400 block mb-1">Barbero Asignado</label>
                  <select
                    value={newBarberId}
                    onChange={e => setNewBarberId(e.target.value)}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white cursor-pointer"
                  >
                    {barbers.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Hora de Inicio</label>
                  <select
                    value={newStartTime}
                    onChange={e => setNewStartTime(e.target.value)}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono cursor-pointer"
                  >
                    {timeSlots.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-neutral-400 block mb-1">Descuento Especial (COP)</label>
                  <CopAmountInput value={newDiscount} onChange={setNewDiscount} ariaLabel="Descuento de cita en COP"
                    className="bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono" />
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Notas del Corte</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  placeholder="Ej. Corte a tijera arriba y desvanecido en patillas"
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="pt-3 border-t border-[#262626] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewAptModalOpen(false)}
                  className="px-4 py-2 text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[var(--gold-primary)] text-black font-bold hover:bg-[var(--gold-hover)]"
                >
                  Confirmar Cita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Llegada Sin Cita (Walk-in / Espera) */}
      {isWalkInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#141414] border border-amber-500/40 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Registrar Llegada Sin Cita (Walk-in)</h3>
              </div>
              <button
                onClick={() => setIsWalkInModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterWalkIn} className="py-4 space-y-3 text-xs">
              <p className="text-neutral-400 text-xs">
                El cliente se incorporará de inmediato a la cola de espera de la barbería.
              </p>

              <div>
                <label className="text-neutral-400 block mb-1">Nombre del Cliente</label>
                <input
                  type="text"
                  required
                  value={walkInCustName}
                  onChange={e => setWalkInCustName(e.target.value)}
                  placeholder="Ej. Roberto Martínez (Llegó en el momento)"
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Teléfono de Contacto (Opcional)</label>
                <input
                  type="text"
                  value={walkInCustPhone}
                  onChange={e => setWalkInCustPhone(e.target.value)}
                  placeholder="+57 312 000 0000"
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Servicio Deseado</label>
                  <select
                    value={walkInServiceId}
                    onChange={e => setWalkInServiceId(e.target.value)}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white cursor-pointer"
                  >
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({formatCurrency(s.price, currency)})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-neutral-400 block mb-1">Barbero a Asignar</label>
                  <select
                    value={walkInBarberId}
                    onChange={e => setWalkInBarberId(e.target.value)}
                    className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white cursor-pointer"
                  >
                    {barbers.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsWalkInModalOpen(false)}
                  className="px-4 py-2 text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-black font-bold hover:bg-amber-400"
                >
                  Agregar a Sala de Espera
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Finalizar y Cobrar Corte */}
      {completingApt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <h3 className="text-base font-bold text-white">Finalizar Servicio & Registrar Pago</h3>
              <button
                onClick={() => setCompletingApt(null)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="p-3 bg-[#181818] rounded-xl border border-neutral-800">
                <div className="text-neutral-400">Cliente: <strong className="text-white">{completingApt.customerName}</strong></div>
                <div className="text-neutral-400">Servicio: <strong className="text-white">{completingApt.serviceName}</strong></div>
                <div className="text-base font-bold font-mono text-[var(--gold-primary)] mt-2">
                  Total a Cobrar: {formatCurrency(completingApt.finalPrice, currency)}
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1.5 font-semibold">Método de Pago Recibido:</label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'cash', label: 'Efectivo en Caja' },
                      { id: 'nequi', label: 'Nequi' },
                      { id: 'daviplata', label: 'Daviplata' },
                      { id: 'debit', label: 'Tarjeta Débito' },
                      { id: 'credit', label: 'Tarjeta Crédito' },
                      { id: 'transfer', label: 'Transferencia Bancolombia' },
                    ] as const
                  ).map(method => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethodForComplete(method.id)}
                      className={`p-2.5 rounded-xl border text-left font-medium transition-colors ${
                        paymentMethodForComplete === method.id
                          ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] font-bold'
                          : 'border-neutral-800 bg-[#181818] text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#262626] flex justify-end gap-2">
              <button
                onClick={() => setCompletingApt(null)}
                className="px-4 py-2 text-neutral-400 hover:text-white text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCompletion}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400"
              >
                Confirmar Cobro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
