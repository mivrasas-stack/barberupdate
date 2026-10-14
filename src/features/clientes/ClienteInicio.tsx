import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {useCustomerLinks} from '../../services/useCustomerLinks';
import {isLiveBackend} from '../../services/liveBackend';
import {
  LayoutDashboard,
  Calendar,
  Coffee,
  Award,
  History,
  QrCode,
  User,
  ArrowRight,
  Sparkles,
  Search,
  Clock,
  Scissors,
  Star,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';

export const ClienteInicio: React.FC = () => {
  const { state, currentUser, navigate } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const {items:linkedBusinesses,loading:linkedLoading}=useCustomerLinks(currentUser?.id);

  const customerId = currentUser?.id || 'usr-client-1';
  const loyalty = state.loyalty[customerId] || (!isLiveBackend ? state.loyalty['usr-client-1'] : undefined) || {points: isLiveBackend?0:420};

  // Next appointment
  const customerAppointments = state.appointments.filter(a => a.customerId === customerId || (!isLiveBackend&&a.customerName?.includes('Camilo')));
  const nextAppointment = customerAppointments.find(a => a.status === 'confirmed' || a.status === 'pending' || a.status === 'waiting');
  const nextAppointmentBarber = nextAppointment ? state.barbers.find(b => b.id === nextAppointment.barberId) : null;

  const modules = [
    {
      id: 'dashboard',
      title: 'Mi Panel de Cliente',
      desc: 'Vista general de tu perfil, barbería vinculada, estado de tus citas activas y balance de beneficios.',
      icon: LayoutDashboard,
      gradient: 'from-amber-500 to-yellow-600',
      badge: 'Resumen General',
      badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
      path: '/clientes/dashboard',
    },
    {
      id: 'citas',
      title: 'Agendar Cita',
      desc: 'Reserva tu próximo turno en 3 pasos: elige a tu barbero preferido, servicio, fecha y hora disponible.',
      icon: Calendar,
      gradient: 'from-blue-500 to-indigo-600',
      badge: 'Agendamiento Rápido',
      badgeColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
      path: '/clientes/citas/nueva',
    },
    {
      id: 'sala-espera',
      title: 'Sala de Espera & Pedidos',
      desc: 'Sigue tu turno en tiempo real desde tu móvil, tiempo de espera estimado y pide café o bebidas al mostrador.',
      icon: Coffee,
      gradient: 'from-emerald-500 to-teal-600',
      badge: 'Turno en Vivo',
      badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
      path: '/clientes/sala-espera',
    },
    {
      id: 'fidelizacion',
      title: 'Puntos & Fidelidad',
      desc: 'Tu tarjeta virtual de lealtad estilo Apple Wallet. Acumula puntos con cada corte y canjea premios exclusivos.',
      icon: Award,
      gradient: 'from-purple-500 to-violet-600',
      badge: `${loyalty.points ?? 0} puntos`,
      badgeColor: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
      path: '/clientes/fidelizacion',
    },
    {
      id: 'historial',
      title: 'Historial & Reseñas',
      desc: 'Revisa tus cortes pasados, comprobantes de pago digitales y califica a tus barberos con estrellas.',
      icon: History,
      gradient: 'from-rose-500 to-pink-600',
      badge: `${customerAppointments.length} cortes`,
      badgeColor: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
      path: '/clientes/historial',
    },
    {
      id: 'vincular',
      title: 'Escanear / Vincular QR',
      desc: 'Escanea el código QR del mostrador de tu barbería o introduce su código para asociar tu cuenta al instante.',
      icon: QrCode,
      gradient: 'from-teal-500 to-emerald-600',
      badge: 'Escanear QR',
      badgeColor: 'text-teal-400 bg-teal-400/10 border-teal-400/20',
      path: '/clientes/vincular',
    },
    {
      id: 'perfil',
      title: 'Mi Perfil & Estilo',
      desc: 'Guarda tus preferencias de corte (número de máquina, degradado, tipo de barba) y actualiza tus datos.',
      icon: User,
      gradient: 'from-amber-600 to-orange-700',
      badge: 'Preferencia Fade',
      badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
      path: '/clientes/perfil',
    },
  ];

  const filteredModules = modules.filter(m =>
    m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.desc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Barber Paradise Luxury Client Hero Banner & Loyalty Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Welcome Section */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-[28px] bg-[#141414] border border-[#242424] p-6 sm:p-8 shadow-[0_22px_54px_rgba(0,0,0,0.5)] flex flex-col justify-between">
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#e5a700]/12 blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={currentUser?.avatar || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80'}
                alt={currentUser?.name || 'Cliente'}
                className="w-14 h-14 rounded-2xl object-cover ring-2 ring-[#e5a700] shadow-md"
              />
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1e1e1e] border border-[#2c2c2c] text-[11px] font-semibold text-neutral-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[#e5a700] font-extrabold uppercase tracking-wider text-[10px]">Cliente Preferencial</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-[850] uppercase tracking-[-0.8px] text-white mt-1">
                  ¡HOLA, <span className="text-[#e5a700]">{currentUser?.name?.split(' ')[0] || 'CAMILO'}</span>! 👋
                </h1>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#aaaaaa] max-w-xl">
              Bienvenido a tu portal personal. Agenda tus citas, monitorea tu turno en vivo en la sala de espera y aprovecha tus puntos acumulados.
            </p>

            {/* Next appointment highlight */}
            {nextAppointment ? (
              <div className="p-4 rounded-2xl bg-[#181818] border border-[#242424] flex items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#222222] border border-[#2a2a2a] text-[#e5a700] flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#e5a700] block">
                      Próxima Cita Confirmada
                    </span>
                    <p className="text-xs font-bold text-white">
                      {nextAppointment.serviceName} • {nextAppointmentBarber?.name || 'Barbero'}
                    </p>
                    <p className="text-[11px] text-[#aaaaaa] font-mono">
                      {nextAppointment.date} a las {nextAppointment.startTime} ({nextAppointment.durationMinutes} min)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/clientes/sala-espera')}
                  className="px-3.5 py-1.5 rounded-xl bp-button-gold text-xs shadow-md shrink-0"
                >
                  Ver Sala
                </button>
              </div>
            ) : null}
          </div>

          {/* Quick shortcuts */}
          <div className="relative z-10 mt-6 pt-4 border-t border-[#242424] flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/clientes/citas/nueva')}
              className="px-4 py-2 rounded-xl bp-button-gold text-xs flex items-center gap-1.5 shadow-md"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Agendar Nueva Cita</span>
            </button>
            <button
              onClick={() => navigate('/clientes/sala-espera')}
              className="px-3.5 py-2 rounded-xl bg-[#1e1e1e] hover:bg-[#252525] border border-[#2c2c2c] text-xs font-medium text-white transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <Coffee className="w-3.5 h-3.5 text-[#e5a700]" />
              <span>Sala de Espera</span>
            </button>
            <button
              onClick={() => navigate('/clientes/vincular')}
              className="px-3.5 py-2 rounded-xl bg-[#1e1e1e] hover:bg-[#252525] border border-[#2c2c2c] text-xs font-medium text-white transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5 text-[#e5a700]" />
              <span>Escanear QR</span>
            </button>
          </div>
        </div>

        {/* Barber Paradise Luxury Loyalty Pass Card */}
        <div
          onClick={() => navigate('/clientes/fidelizacion')}
          className="relative overflow-hidden rounded-[28px] bg-[#141414] border border-[#e5a700]/30 p-6 flex flex-col justify-between shadow-[0_22px_54px_rgba(0,0,0,0.5)] group cursor-pointer hover:border-[#e5a700]/60 transition-all duration-300 hover:-translate-y-1"
        >
          {/* Gold shimmer background effect */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-[#e5a700]/20 to-transparent rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#222222] border border-[#2a2a2a] text-[#e5a700] flex items-center justify-center font-black">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#e5a700] block">
                    Membresía VIP
                  </span>
                  <h3 className="text-sm font-[850] uppercase tracking-wide text-white">Barber Club Elite</h3>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#e5a700]/20 border border-[#e5a700]/40 text-[10px] font-bold text-[#e5a700]">
                Nivel Oro
              </span>
            </div>

            <div className="mt-4 p-4 rounded-2xl bg-[#181818] border border-[#242424]">
              <span className="text-[10px] uppercase tracking-wider text-[#aaaaaa] block font-semibold">Puntos Acumulados</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-[850] text-[#e5a700] font-mono">{loyalty.points ?? 0}</span>
                <span className="text-xs text-[#aaaaaa] font-medium">/ 500 para corte gratis</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#222222] h-2 rounded-full mt-2.5 overflow-hidden border border-[#2c2c2c]">
                <div
                  className="bg-gradient-to-r from-amber-500 to-[#e5a700] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, ((loyalty.points ?? 0) / 500) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-[#aaaaaa] block mt-1.5 text-right font-mono">
                Faltan {Math.max(0, 500 - (loyalty.points ?? 0))} pts
              </span>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-[#242424] flex items-center justify-between text-xs text-[#e5a700] font-bold">
            <span>VER RECOMPENSAS Y CANJES</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Verified, persistent affiliations — not inferred from appointments or mock data. */}
      <section data-testid="linked-businesses" className="rounded-3xl border border-white/[0.08] bg-[#151515] p-5 sm:p-6">
        <div className="flex justify-between items-center mb-4 gap-4">
          <div><h2 className="text-lg font-extrabold text-white">Mis Barberías y Barberos Vinculados</h2>
          <p className="text-xs text-neutral-400">Negocios que vinculaste escaneando su QR</p></div>
          <button onClick={()=>navigate('/clientes/vincular')} className="text-xs rounded-xl px-3 py-2 bg-[var(--gold-primary)] text-black font-bold">+ Vincular QR</button>
        </div>
        {linkedLoading?<p className="text-xs text-neutral-400">Cargando vínculos...</p>:
         linkedBusinesses.length===0?<p className="text-xs text-neutral-400">Todavía no tienes barberías o profesionales vinculados.</p>:
         <div className="grid sm:grid-cols-2 gap-3">{linkedBusinesses.map(link=>
          <button key={link.tenant_id} onClick={()=>navigate('/clientes/citas/nueva')}
           className="p-4 rounded-2xl bg-[#1e1e1e] border border-neutral-700 text-left hover:border-[var(--gold-primary)]">
           <span className="text-[10px] uppercase text-[var(--gold-primary)]">{link.business_kind==='independent'?'Barbero independiente':'Barbería'}</span>
           <h3 className="text-white font-bold mt-1">{link.barber_name||link.name}</h3>
           <span className="text-neutral-400 text-xs">Agendar cita →</span>
          </button>)}</div>}
      </section>

      {/* Modules Finder */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Tus Servicios & Módulos</span>
            <span className="text-xs font-normal text-neutral-400 font-mono bg-white/[0.06] px-2 py-0.5 rounded-full border border-white/[0.08]">
              {modules.length} disponibles
            </span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Accede rápidamente a tus citas, sala de espera, fidelización y perfil
          </p>
        </div>

        {/* Search bar */}
        <div className="relative sm:w-64">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar módulo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-neutral-500 focus:outline-none focus:border-[var(--gold-primary)] transition-all"
          />
        </div>
      </div>

      {/* Grid of Barber Paradise Luxury Module Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredModules.map(module => {
          const Icon = module.icon;
          return (
            <div
              key={module.id}
              onClick={() => navigate(module.path)}
              className="group relative overflow-hidden rounded-[24px] bp-card p-6 cursor-pointer flex flex-col justify-between"
            >
              {/* Top specular highlight */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#e5a700]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#222222] border border-[#2c2c2c] flex items-center justify-center text-[#e5a700] shrink-0 group-hover:scale-105 group-hover:border-[#e5a700]/50 transition-all duration-300">
                    <Icon className="w-5 h-5" strokeWidth={1.8} />
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border font-mono ${module.badgeColor}`}>
                    {module.badge}
                  </span>
                </div>

                <h3 className="text-base font-[850] uppercase tracking-[-0.5px] text-[#f6f6f6] group-hover:text-[#e5a700] transition-colors">
                  {module.title}
                </h3>
                <p className="text-xs text-[#aaaaaa] mt-2 leading-relaxed">
                  {module.desc}
                </p>
              </div>

              {/* Card Footer / Action Link */}
              <div className="mt-6 pt-4 border-t border-[#242424] flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#aaaaaa] group-hover:text-white transition-colors">
                  Abrir módulo
                </span>
                <div className="w-8 h-8 rounded-full bg-[#222222] border border-[#2a2a2a] flex items-center justify-center text-neutral-300 group-hover:text-black group-hover:bg-[#e5a700] group-hover:border-[#e5a700] transition-all duration-300">
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
