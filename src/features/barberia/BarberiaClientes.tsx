import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { UserCheck, Search, Phone, Mail, Calendar, Scissors, Award, Star } from 'lucide-react';

export const BarberiaClientes: React.FC = () => {
  const { currentShop, state, currency } = useApp();
  const [search, setSearch] = useState('');

  const shopId = currentShop?.id || 'shop-1';

  // Customers that have appointments in this shop
  const shopAppointments = state.appointments.filter(a => a.businessId === shopId);
  const customerIds = Array.from(new Set(shopAppointments.map(a => a.customerId)));

  const customers = customerIds.map(id => {
    const user = state.users.find(u => u.id === id);
    const apts = shopAppointments.filter(a => a.customerId === id);
    const totalSpent = apts
      .filter(a => a.status === 'completed')
      .reduce((acc, a) => acc + a.finalPrice, 0);
    const lastApt = apts[0];

    return {
      id,
      name: user?.name || apts[0]?.customerName || 'Cliente Particular',
      email: user?.email || 'cliente@movil.co',
      phone: user?.phone || apts[0]?.customerPhone || '+57 300 000 0000',
      avatar: user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
      totalVisits: apts.length,
      totalSpent,
      lastVisitDate: lastApt?.date || '2026-10-13',
      favoriteService: lastApt?.serviceName || 'Corte Clásico',
    };
  }).filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Fidelización & CRM
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Clientes de la Barbería</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Historial de visitas, recurrencia, valor acumulado y preferencias de corte
          </p>
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

      <div className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#262626] bg-[#181818] text-neutral-400">
                <th className="py-3 px-4 font-semibold">Cliente</th>
                <th className="py-3 px-4 font-semibold">Teléfono / WhatsApp</th>
                <th className="py-3 px-4 font-semibold">Visitas Registradas</th>
                <th className="py-3 px-4 font-semibold">Último Servicio</th>
                <th className="py-3 px-4 font-semibold">Gasto Acumulado</th>
                <th className="py-3 px-4 font-semibold">Estado de Fidelidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e]">
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-[#181818] transition-colors">
                  <td className="py-3 px-4 font-medium text-white flex items-center gap-3">
                    <img src={c.avatar} alt={c.name} className="w-8 h-8 rounded-full object-cover border border-neutral-700" />
                    <div>
                      <div className="font-bold">{c.name}</div>
                      <div className="text-[11px] text-neutral-400">{c.email}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-neutral-300">{c.phone}</td>
                  <td className="py-3 px-4 font-mono font-bold text-white">{c.totalVisits} visitas</td>
                  <td className="py-3 px-4 text-neutral-300">
                    <div>{c.favoriteService}</div>
                    <div className="text-[10px] text-neutral-500 font-mono">{c.lastVisitDate}</div>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-[var(--gold-primary)]">
                    {formatCurrency(c.totalSpent, currency)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#D9A323]/10 text-[#D9A323] border border-[#D9A323]/30">
                      Cliente VIP
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
