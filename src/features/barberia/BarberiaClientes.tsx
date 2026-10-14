import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { isLiveBackend, listTenantCustomers, type TenantCustomer } from '../../services/liveBackend';
import { 
  UserCheck, Search, Phone, Mail, Calendar, Scissors, Award, Star, 
  QrCode, X, Clock, DollarSign, CheckCircle2, ChevronRight, User
} from 'lucide-react';

export const BarberiaClientes: React.FC = () => {
  const { currentShop, state, currency } = useApp();
  const [search, setSearch] = useState('');
  const [backendCustomers, setBackendCustomers] = useState<TenantCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const shopId = currentShop?.id || 'shop-1';

  // Fetch real customers from live backend
  useEffect(() => {
    if (!isLiveBackend || !currentShop?.id) return;
    let active = true;
    setLoading(true);
    listTenantCustomers(currentShop.id)
      .then(res => {
        if (active) setBackendCustomers(res.items || []);
      })
      .catch(err => {
        console.error('Error fetching tenant customers:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [currentShop?.id]);

  // Appointments for this shop in state
  const shopAppointments = useMemo(() => {
    return state.appointments.filter(a => a.businessId === shopId);
  }, [state.appointments, shopId]);

  // Consolidate customer records from backend + store state
  const customers = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      email: string;
      phone: string;
      avatar: string;
      isLinked: boolean;
      linkedAt: string | null;
      preferredBarberName: string | null;
      totalVisits: number;
      totalSpent: number;
      lastVisitDate: string | null;
      favoriteService: string;
    }> = [];

    const processedIds = new Set<string>();

    // Add backend customers
    backendCustomers.forEach(bc => {
      processedIds.add(bc.id);
      const user = state.users.find(u => u.id === bc.id);
      const apts = shopAppointments.filter(a => a.customerId === bc.id);
      const totalVisits = Math.max(bc.total_appointments || 0, apts.length);
      const totalSpent = (bc.total_spent_minor ? Number(bc.total_spent_minor) : 0) || 
        apts.filter(a => a.status === 'completed').reduce((acc, a) => acc + a.finalPrice, 0);
      const lastApt = apts[0];
      const lastVisit = bc.last_visit_at ? bc.last_visit_at.slice(0, 10) : (lastApt?.date || null);

      list.push({
        id: bc.id,
        name: bc.name || user?.name || 'Cliente Particular',
        email: user?.email || (bc.id.includes('-') ? `${bc.name.toLowerCase().replace(/\s+/g, '')}@cliente.app` : 'cliente@movil.co'),
        phone: bc.phone || user?.phone || '+57 300 000 0000',
        avatar: user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
        isLinked: bc.is_linked,
        linkedAt: bc.linked_at,
        preferredBarberName: bc.preferred_barber_name,
        totalVisits,
        totalSpent,
        lastVisitDate: lastVisit,
        favoriteService: lastApt?.serviceName || (bc.preferred_barber_name ? `Atendido por ${bc.preferred_barber_name}` : 'Sin servicios previos'),
      });
    });

    // In mock mode or fallback: include customers from local appointments
    if (!isLiveBackend || backendCustomers.length === 0) {
      const customerIds = Array.from(new Set(shopAppointments.map(a => a.customerId)));
      customerIds.forEach(id => {
        if (processedIds.has(id)) return;
        processedIds.add(id);
        const user = state.users.find(u => u.id === id);
        const apts = shopAppointments.filter(a => a.customerId === id);
        const totalSpent = apts
          .filter(a => a.status === 'completed')
          .reduce((acc, a) => acc + a.finalPrice, 0);
        const lastApt = apts[0];

        list.push({
          id,
          name: user?.name || apts[0]?.customerName || 'Cliente Particular',
          email: user?.email || 'cliente@movil.co',
          phone: user?.phone || apts[0]?.customerPhone || '+57 300 000 0000',
          avatar: user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
          isLinked: false,
          linkedAt: null,
          preferredBarberName: null,
          totalVisits: apts.length,
          totalSpent,
          lastVisitDate: lastApt?.date || null,
          favoriteService: lastApt?.serviceName || 'Corte Clásico',
        });
      });
    }

    return list.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.phone.includes(search)
    );
  }, [backendCustomers, shopAppointments, state.users, search, isLiveBackend]);

  // Selected customer object & their full appointment history
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const customerAppointments = useMemo(() => {
    if (!selectedCustomerId) return [];
    return shopAppointments.filter(a => a.customerId === selectedCustomerId);
  }, [shopAppointments, selectedCustomerId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Fidelización & CRM
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Clientes de la Barbería</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Clientes vinculados por Código QR, historial de citas agendadas, valor acumulado y métricas de recurrencia.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-[#181818] border border-[#2a2a2a] text-xs text-neutral-300 font-mono">
            Total Clientes: <span className="font-bold text-[var(--gold-primary)]">{customers.length}</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar clientes por nombre o teléfono..."
          className="w-full bg-[#141414] border border-[#262626] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--gold-primary)] transition-colors"
        />
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-neutral-400 bg-[#141414] border border-[#262626] rounded-2xl">
          Cargando clientes de la barbería...
        </div>
      ) : customers.length === 0 ? (
        <div className="p-12 text-center bg-[#141414] border border-[#262626] rounded-2xl space-y-3">
          <User className="w-10 h-10 text-neutral-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">No hay clientes encontrados</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Los clientes que escaneen tu Código QR de vinculación o que agenden citas aparecerán automáticamente en esta lista.
          </p>
        </div>
      ) : (
        <div className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#262626] bg-[#181818] text-neutral-400">
                  <th className="py-3 px-4 font-semibold">Cliente</th>
                  <th className="py-3 px-4 font-semibold">Teléfono / WhatsApp</th>
                  <th className="py-3 px-4 font-semibold">Origen / Vinculación</th>
                  <th className="py-3 px-4 font-semibold">Visitas Registradas</th>
                  <th className="py-3 px-4 font-semibold">Último Servicio / Fecha</th>
                  <th className="py-3 px-4 font-semibold">Gasto Acumulado</th>
                  <th className="py-3 px-4 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e1e]">
                {customers.map(c => (
                  <tr 
                    key={c.id} 
                    onClick={() => setSelectedCustomerId(c.id)}
                    className="hover:bg-[#181818] transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-medium text-white flex items-center gap-3">
                      <img src={c.avatar} alt={c.name} className="w-8 h-8 rounded-full object-cover border border-neutral-700" />
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          {c.name}
                          {c.isLinked && (
                            <span title="Vinculado por QR" className="inline-flex items-center text-[#D9A323]">
                              <QrCode className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-400">{c.email}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-300">{c.phone || '—'}</td>
                    <td className="py-3 px-4">
                      {c.isLinked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#D9A323]/10 text-[#D9A323] border border-[#D9A323]/30">
                          <QrCode className="w-3 h-3" />
                          Vinculado QR
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">
                          Solo Citas
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {c.totalVisits} {c.totalVisits === 1 ? 'visita' : 'visitas'}
                    </td>
                    <td className="py-3 px-4 text-neutral-300">
                      <div>{c.favoriteService}</div>
                      <div className="text-[10px] text-neutral-500 font-mono">
                        {c.lastVisitDate ? `Última: ${c.lastVisitDate}` : (c.linkedAt ? `Vinculado: ${c.linkedAt.slice(0, 10)}` : 'Sin registros')}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-[var(--gold-primary)]">
                      {formatCurrency(c.totalSpent, currency)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomerId(c.id);
                        }}
                        className="p-1.5 rounded-lg bg-neutral-800 group-hover:bg-[#D9A323] text-neutral-300 group-hover:text-black transition-colors"
                        title="Ver detalle del cliente"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Detail Drawer / Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-2xl rounded-2xl p-6 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#242424]">
              <div className="flex items-center gap-4">
                <img 
                  src={selectedCustomer.avatar} 
                  alt={selectedCustomer.name} 
                  className="w-14 h-14 rounded-full object-cover border-2 border-[var(--gold-primary)]" 
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white tracking-tight">{selectedCustomer.name}</h2>
                    {selectedCustomer.isLinked && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#D9A323]/10 text-[#D9A323] border border-[#D9A323]/30 flex items-center gap-1">
                        <QrCode className="w-3 h-3" />
                        Vinculado QR
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-3">
                    <span>{selectedCustomer.email}</span>
                    <span>•</span>
                    <span className="font-mono text-neutral-300">{selectedCustomer.phone}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCustomerId(null)}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#191919] border border-[#262626] rounded-xl p-3.5">
                <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                  Total Citas / Visitas
                </div>
                <div className="text-xl font-bold text-white mt-1">
                  {selectedCustomer.totalVisits}
                </div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  {selectedCustomer.lastVisitDate ? `Última: ${selectedCustomer.lastVisitDate}` : 'Sin visitas completadas'}
                </div>
              </div>

              <div className="bg-[#191919] border border-[#262626] rounded-xl p-3.5">
                <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Gasto Acumulado
                </div>
                <div className="text-xl font-bold text-[var(--gold-primary)] mt-1 font-mono">
                  {formatCurrency(selectedCustomer.totalSpent, currency)}
                </div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  Servicios y productos facturados
                </div>
              </div>

              <div className="bg-[#191919] border border-[#262626] rounded-xl p-3.5">
                <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#D9A323]" />
                  Fidelidad
                </div>
                <div className="text-sm font-bold text-white mt-1">
                  {selectedCustomer.totalVisits >= 5 ? 'Cliente VIP Oro' : selectedCustomer.totalVisits >= 2 ? 'Cliente Frecuente' : 'Nuevo Cliente'}
                </div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  {selectedCustomer.isLinked && selectedCustomer.linkedAt 
                    ? `Vinculado desde: ${selectedCustomer.linkedAt.slice(0, 10)}` 
                    : 'Vinculación directa'}
                </div>
              </div>
            </div>

            {/* Appointment history section */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Scissors className="w-4 h-4 text-[var(--gold-primary)]" />
                Historial de Citas y Servicios en esta Barbería
              </h3>

              {customerAppointments.length === 0 ? (
                <div className="p-6 text-center bg-[#191919] border border-[#262626] rounded-xl space-y-1">
                  <p className="text-xs text-neutral-300 font-medium">No tiene citas registradas en el sistema aún</p>
                  <p className="text-[11px] text-neutral-500">
                    El cliente ya está vinculado por QR a tu barbería y podrá agendar citas en cualquier momento.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#242424] border border-[#262626] rounded-xl bg-[#181818] overflow-hidden">
                  {customerAppointments.map(apt => (
                    <div key={apt.id} className="p-3.5 flex items-center justify-between gap-4 text-xs hover:bg-[#202020] transition-colors">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{apt.serviceName}</span>
                          <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                            apt.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                            apt.status === 'cancelled' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}>
                            {apt.status === 'completed' ? 'Completada' : apt.status === 'cancelled' ? 'Cancelada' : 'Pendiente / En Espera'}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400 flex items-center gap-3">
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3 text-neutral-500" />
                            {apt.date}
                          </span>
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-neutral-500" />
                            {apt.startTime} - {apt.endTime}
                          </span>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <div className="font-bold text-white">
                          {formatCurrency(apt.finalPrice, currency)}
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          {apt.paymentMethod || 'Efectivo'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-3 border-t border-[#242424]">
              <button
                onClick={() => setSelectedCustomerId(null)}
                className="px-4 py-2 rounded-xl bg-[#202020] hover:bg-[#282828] text-xs font-semibold text-white transition-colors"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
