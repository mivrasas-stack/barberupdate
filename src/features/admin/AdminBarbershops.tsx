import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Barbershop } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import {
  Store,
  Search,
  LayoutGrid,
  List,
  MapPin,
  Phone,
  Mail,
  Users,
  Scissors,
  Star,
  ExternalLink,
  X,
  CreditCard,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

export const AdminBarbershops: React.FC = () => {
  const { state, currency, navigate, addToast } = useApp();
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [selectedShop, setSelectedShop] = useState<Barbershop | null>(null);
  const [detailTab, setDetailTab] = useState<'summary' | 'owner' | 'barbers' | 'services' | 'reviews'>('summary');

  const filteredShops = state.barbershops.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.city.toLowerCase().includes(search.toLowerCase()) ||
      s.address.toLowerCase().includes(search.toLowerCase());
    const matchesCity = cityFilter === 'all' || s.city.toLowerCase().includes(cityFilter.toLowerCase());
    return matchesSearch && matchesCity;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Red de Negocios
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Franquicias & Barberías</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Supervisa los locales comerciales, equipos de barberos y su rendimiento comercial
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 p-1 bg-[#161616] border border-[#2a2a2a] rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'cards' ? 'bg-[var(--gold-primary)] text-black' : 'text-neutral-400 hover:text-white'
            }`}
            title="Vista Cuadrícula"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'table' ? 'bg-[var(--gold-primary)] text-black' : 'text-neutral-400 hover:text-white'
            }`}
            title="Vista Tabla"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-[#141414] border border-[#262626] rounded-2xl p-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, ciudad o dirección..."
            className="w-full bg-[#181818] border border-[#2a2a2a] rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[var(--gold-primary)] transition-colors"
          />
        </div>

        <select
          value={cityFilter}
          onChange={e => setCityFilter(e.target.value)}
          className="bg-[#181818] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-[var(--gold-primary)] cursor-pointer"
        >
          <option value="all">Todas las ciudades</option>
          <option value="Bogotá">Bogotá D.C.</option>
          <option value="Medellín">Medellín</option>
          <option value="Cali">Cali</option>
        </select>
      </div>

      {/* Cards View */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShops.map(shop => {
            const barbers = state.barbers.filter(b => b.businessId === shop.id);
            const services = state.services.filter(s => s.businessId === shop.id);
            const owner = state.users.find(u => u.id === shop.ownerId);

            return (
              <div
                key={shop.id}
                className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between hover:border-[var(--gold-primary)]/50 transition-all group"
              >
                <div>
                  {/* Cover Header */}
                  <div className="relative h-32 w-full overflow-hidden bg-neutral-900">
                    <img
                      src={shop.coverImage}
                      alt={shop.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/40 to-transparent" />
                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/60 backdrop-blur-md text-[var(--gold-primary)] border border-[var(--gold-primary)]/40">
                        {shop.planId === 'plan-shop-pro' ? 'Plan Pro Imperio' : 'Plan Estudio'}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 pt-0 relative -mt-6">
                    <div className="flex items-end justify-between mb-3">
                      <img
                        src={shop.logo}
                        alt={shop.name}
                        className="w-14 h-14 rounded-xl object-cover border-2 border-[#141414] shadow-lg"
                      />
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-black/40 px-2 py-1 rounded-lg border border-neutral-800">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{shop.rating}</span>
                        <span className="text-[10px] text-neutral-400 font-normal">({shop.reviewsCount})</span>
                      </div>
                    </div>

                    <h2 className="text-base font-bold text-white group-hover:text-[var(--gold-primary)] transition-colors">
                      {shop.name}
                    </h2>
                    <p className="text-xs text-neutral-400 mt-0.5 line-clamp-1">{shop.tagline}</p>

                    <div className="mt-4 space-y-1.5 text-xs text-neutral-400">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                        <span className="truncate">{shop.address}, {shop.city}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                        <span>{shop.phone}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-neutral-800/80 grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-2 rounded-xl bg-[#191919] border border-neutral-800">
                        <span className="text-neutral-500 text-[10px] uppercase font-semibold block">Sillas / Barberos</span>
                        <span className="text-sm font-bold font-mono text-white">{barbers.length} activos</span>
                      </div>
                      <div className="p-2 rounded-xl bg-[#191919] border border-neutral-800">
                        <span className="text-neutral-500 text-[10px] uppercase font-semibold block">Servicios</span>
                        <span className="text-sm font-bold font-mono text-white">{services.length} listados</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 pt-2 border-t border-neutral-800/80 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedShop(shop);
                      setDetailTab('summary');
                    }}
                    className="flex-1 py-2 rounded-xl bg-[#202020] hover:bg-[#2a2a2a] text-xs font-semibold text-white transition-colors"
                  >
                    Ficha Detalle
                  </button>
                  <button
                    onClick={() => navigate(`/barberia/${shop.slug}/dashboard`)}
                    className="p-2 rounded-xl bg-[var(--gold-primary)] text-black hover:bg-[var(--gold-hover)] transition-colors"
                    title="Abrir panel administrativo de la barbería"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#262626] bg-[#181818] text-neutral-400">
                  <th className="py-3.5 px-4 font-semibold">Barbería</th>
                  <th className="py-3.5 px-4 font-semibold">Ciudad / Dirección</th>
                  <th className="py-3.5 px-4 font-semibold">Propietario</th>
                  <th className="py-3.5 px-4 font-semibold">Barberos</th>
                  <th className="py-3.5 px-4 font-semibold">Plan SaaS</th>
                  <th className="py-3.5 px-4 font-semibold">Valoración</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e1e]">
                {filteredShops.map(shop => {
                  const barbers = state.barbers.filter(b => b.businessId === shop.id);
                  const owner = state.users.find(u => u.id === shop.ownerId);

                  return (
                    <tr key={shop.id} className="hover:bg-[#181818] transition-colors">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-3">
                        <img src={shop.logo} alt={shop.name} className="w-8 h-8 rounded-lg object-cover border border-neutral-700" />
                        <div>
                          <div>{shop.name}</div>
                          <div className="text-[10px] text-neutral-500 font-mono">/{shop.slug}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-neutral-300">
                        <div>{shop.city}</div>
                        <div className="text-[11px] text-neutral-500">{shop.address}</div>
                      </td>
                      <td className="py-3 px-4 text-neutral-300">
                        <div>{owner?.name || 'Propietario Registrado'}</div>
                        <div className="text-[11px] text-neutral-500">{owner?.phone || shop.phone}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-white">{barbers.length} sillas</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#D9A323]/15 text-[#D9A323] border border-[#D9A323]/30">
                          {shop.planId === 'plan-shop-pro' ? 'Pro Imperio' : 'Estudio'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-amber-400 font-mono">★ {shop.rating}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedShop(shop);
                              setDetailTab('summary');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#242424] text-neutral-200 hover:text-white"
                          >
                            Detalle
                          </button>
                          <button
                            onClick={() => navigate(`/barberia/${shop.slug}/dashboard`)}
                            className="px-2.5 py-1 rounded-lg bg-[var(--gold-primary)] text-black font-semibold"
                          >
                            Abrir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal with Tabs */}
      {selectedShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col justify-between">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
              <div className="flex items-center gap-3">
                <img
                  src={selectedShop.logo}
                  alt={selectedShop.name}
                  className="w-12 h-12 rounded-xl object-cover border-2 border-[var(--gold-primary)]"
                />
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedShop.name}</h3>
                  <p className="text-xs text-neutral-400">{selectedShop.address}, {selectedShop.city}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedShop(null)}
                className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-1 my-3 border-b border-[#262626] text-xs pb-2 overflow-x-auto">
              {(
                [
                  { id: 'summary', label: 'Resumen' },
                  { id: 'owner', label: 'Propietario' },
                  { id: 'barbers', label: 'Equipo Barberos' },
                  { id: 'services', label: 'Servicios' },
                  { id: 'reviews', label: 'Reseñas' },
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDetailTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                    detailTab === tab.id
                      ? 'bg-[var(--gold-primary)] text-black font-bold'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Tab Body */}
            <div className="py-2 space-y-4 overflow-y-auto pr-1 flex-1">
              {detailTab === 'summary' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-3 bg-[#181818] rounded-xl border border-neutral-800">
                      <span className="text-neutral-500 block text-[10px] uppercase">Plan Contratado</span>
                      <span className="font-bold text-[var(--gold-primary)] mt-1 block">
                        {selectedShop.planId === 'plan-shop-pro' ? 'Pro Imperio' : 'Estudio'}
                      </span>
                    </div>
                    <div className="p-3 bg-[#181818] rounded-xl border border-neutral-800">
                      <span className="text-neutral-500 block text-[10px] uppercase">Estado Cuenta</span>
                      <span className="font-bold text-emerald-400 mt-1 block">Activa</span>
                    </div>
                    <div className="p-3 bg-[#181818] rounded-xl border border-neutral-800">
                      <span className="text-neutral-500 block text-[10px] uppercase">Valoración</span>
                      <span className="font-bold text-amber-400 mt-1 block">★ {selectedShop.rating} / 5</span>
                    </div>
                    <div className="p-3 bg-[#181818] rounded-xl border border-neutral-800">
                      <span className="text-neutral-500 block text-[10px] uppercase">Código QR</span>
                      <span className="font-bold font-mono text-white mt-1 block">{selectedShop.publicCode}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-[#181818] rounded-xl border border-neutral-800">
                    <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Horarios de Atención</span>
                    <p className="text-neutral-300">
                      {selectedShop.openingHours.days}: {selectedShop.openingHours.open} - {selectedShop.openingHours.close}
                    </p>
                  </div>
                </div>
              )}

              {detailTab === 'owner' && (
                <div className="p-4 bg-[#181818] rounded-xl border border-neutral-800 text-xs space-y-2">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block">Datos del Administrador Responsable</span>
                  <div className="text-sm font-bold text-white">Mateo Restrepo</div>
                  <div className="text-neutral-400">contacto@barberclub.co</div>
                  <div className="text-neutral-400 font-mono">+57 301 234 5678</div>
                  <div className="pt-2 text-neutral-500 text-[11px]">
                    Fecha de alta en plataforma: 14 de Febrero de 2025
                  </div>
                </div>
              )}

              {detailTab === 'barbers' && (
                <div className="space-y-2">
                  {state.barbers
                    .filter(b => b.businessId === selectedShop.id)
                    .map(barber => (
                      <div key={barber.id} className="flex items-center justify-between p-3 rounded-xl bg-[#181818] border border-neutral-800 text-xs">
                        <div className="flex items-center gap-3">
                          <img src={barber.photo} alt={barber.name} className="w-9 h-9 rounded-full object-cover" />
                          <div>
                            <div className="font-bold text-white">{barber.name}</div>
                            <div className="text-[11px] text-neutral-400">{barber.specialties.join(', ')}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-amber-400">★ {barber.rating}</div>
                          <div className="text-[10px] text-neutral-500">Comisión: {(barber.commissionRate * 100).toFixed(0)}%</div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {detailTab === 'services' && (
                <div className="space-y-2">
                  {state.services
                    .filter(s => s.businessId === selectedShop.id)
                    .map(srv => (
                      <div key={srv.id} className="flex items-center justify-between p-3 rounded-xl bg-[#181818] border border-neutral-800 text-xs">
                        <div>
                          <div className="font-bold text-white">{srv.name}</div>
                          <div className="text-[11px] text-neutral-400">{srv.durationMinutes} minutos · {srv.category}</div>
                        </div>
                        <div className="font-mono font-bold text-[var(--gold-primary)] text-sm">
                          {formatCurrency(srv.price, currency)}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {detailTab === 'reviews' && (
                <div className="space-y-2">
                  {state.reviews
                    .filter(r => r.businessId === selectedShop.id)
                    .map(rev => (
                      <div key={rev.id} className="p-3 rounded-xl bg-[#181818] border border-neutral-800 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-white">{rev.customerName}</span>
                          <span className="text-amber-400 font-mono">{'★'.repeat(rev.rating)}</span>
                        </div>
                        <p className="text-neutral-300 text-[11px]">{rev.comment}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-[#262626] flex items-center justify-between">
              <span className="text-xs text-neutral-400 font-mono">Slug: /{selectedShop.slug}</span>
              <button
                onClick={() => {
                  setSelectedShop(null);
                  navigate(`/barberia/${selectedShop.slug}/dashboard`);
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--gold-primary)] text-black hover:bg-[var(--gold-hover)] flex items-center gap-1.5"
              >
                <span>Abrir Vista de esta Barbería</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
