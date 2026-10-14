import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Barber } from '../../types';
import { barberStore } from '../../services/store';
import { ImageUpload } from '../../components/common/ImageUpload';
import { isLiveBackend, updateBarberProfile, refreshLiveData } from '../../services/liveBackend';
import { formatCurrency } from '../../utils/formatters';
import { 
  Scissors, 
  Plus, 
  Star, 
  Phone, 
  Mail, 
  Clock, 
  Calendar, 
  Image, 
  X, 
  Check, 
  Trash2, 
  Sliders, 
  DollarSign, 
  Briefcase, 
  Building2, 
  TrendingUp, 
  ShieldCheck, 
  UserCheck 
} from 'lucide-react';

export const BarberiaBarberos: React.FC = () => {
  const { currentShop, state, currency, addToast } = useApp();
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [detailBarber, setDetailBarber] = useState<Barber | null>(null);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');

  // Form states for contract agreement
  const [contractType, setContractType] = useState<'commission' | 'chair_rental' | 'hybrid'>('commission');
  const [commissionRate, setCommissionRate] = useState<number>(50);
  const [chairRentalFee, setChairRentalFee] = useState<number>(0);
  const [chairRentalPeriod, setChairRentalPeriod] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('monthly');
  const [barberStatus, setBarberStatus] = useState<'active' | 'inactive'>('active');

  const shopId = currentShop?.id || 'shop-1';
  const barbers = state.barbers.filter(b => b.businessId === shopId);

  const handleOpenDetail = (barber: Barber) => {
    setDetailBarber(barber);
    setContractType(barber.contractType || 'commission');
    setCommissionRate(Math.round((barber.commissionRate || 0.5) * 100));
    setChairRentalFee(barber.chairRentalFee || 0);
    setChairRentalPeriod(barber.chairRentalPeriod || 'monthly');
    setBarberStatus(barber.status || 'active');
  };

  const handleSaveContractAgreement = () => {
    if (!detailBarber) return;
    const res = barberStore.updateBarber(detailBarber.id, {
      contractType,
      commissionRate: commissionRate / 100,
      chairRentalFee: Number(chairRentalFee) || 0,
      chairRentalPeriod,
      status: barberStatus,
    });

    if (!res.success) {
      addToast(res.error || 'Error al guardar acuerdo', 'error');
      return;
    }

    addToast(`Condiciones de trabajo actualizadas para ${detailBarber.name}`, 'success');
    setDetailBarber(null);
  };

  const handleAddPhoto = (urlToAdd?: string) => {
    const photoUrl = (urlToAdd || newPhotoUrl).trim();
    if (!selectedBarber || !photoUrl) return;
    const res = barberStore.addPortfolioPhoto('barber', selectedBarber.id, photoUrl);
    if (!res.success) {
      addToast(res.error || 'Error al añadir foto', 'error');
      return;
    }

    if (isLiveBackend && currentShop) {
      const updatedPortfolio = [...selectedBarber.portfolio, photoUrl];
      updateBarberProfile(currentShop.id, selectedBarber.id, { portfolio: updatedPortfolio })
        .then(() => refreshLiveData())
        .catch(e => console.error('Error sincronizando portafolio barbero:', e));
    }

    addToast('Fotografía agregada al portafolio profesional', 'success');
    setNewPhotoUrl('');
    // Refresh local selected
    const updated = state.barbers.find(b => b.id === selectedBarber.id);
    if (updated) setSelectedBarber({ ...updated });
  };

  const handleRemovePhoto = (index: number) => {
    if (!selectedBarber) return;
    barberStore.removePortfolioPhoto('barber', selectedBarber.id, index);

    if (isLiveBackend && currentShop) {
      const updatedPortfolio = selectedBarber.portfolio.filter((_, i) => i !== index);
      updateBarberProfile(currentShop.id, selectedBarber.id, { portfolio: updatedPortfolio })
        .then(() => refreshLiveData())
        .catch(e => console.error('Error sincronizando portafolio barbero:', e));
    }

    addToast('Fotografía eliminada del portafolio', 'info');
    const updated = state.barbers.find(b => b.id === selectedBarber.id);
    if (updated) setSelectedBarber({ ...updated });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Talento & Sillas
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Barberos & Equipo</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Gestiona comisiones, horarios de trabajo, especialidades y portafolios fotográficos
          </p>
        </div>
      </div>

      {/* Barbers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {barbers.map(barber => {
          const portfolioCount = barber.portfolio.length;

          return (
            <div
              key={barber.id}
              className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start gap-4 mb-4">
                  <img
                    src={barber.photo}
                    alt={barber.name}
                    className="w-16 h-16 rounded-xl object-cover border-2 border-[var(--gold-primary)] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white truncate">{barber.name}</h3>
                      <div className="flex items-center gap-1 text-amber-400 text-xs font-mono font-bold">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span>{barber.rating}</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-[var(--gold-primary)] font-medium mt-0.5">
                      {barber.specialties.join(' · ')}
                    </div>
                    <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{barber.bio}</p>
                  </div>
                </div>

                <div className="p-3 bg-[#181818] rounded-xl border border-neutral-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-neutral-300">
                    <span className="text-neutral-500">Modalidad de Trabajo:</span>
                    <span className="font-bold text-xs">
                      {barber.contractType === 'chair_rental' ? (
                        <span className="text-amber-400">Arriendo de Silla</span>
                      ) : barber.contractType === 'hybrid' ? (
                        <span className="text-sky-400">Híbrido (Silla + %)</span>
                      ) : (
                        <span className="text-emerald-400">Comisión por Servicio</span>
                      )}
                    </span>
                  </div>
                  {barber.contractType !== 'chair_rental' && (
                    <div className="flex items-center justify-between text-neutral-300">
                      <span className="text-neutral-500">Comisión Barbero:</span>
                      <span className="font-mono font-bold text-emerald-400">{(barber.commissionRate * 100).toFixed(0)}%</span>
                    </div>
                  )}
                  {(barber.contractType === 'chair_rental' || barber.contractType === 'hybrid') && (
                    <div className="flex items-center justify-between text-neutral-300">
                      <span className="text-neutral-500">Valor Arriendo Silla:</span>
                      <span className="font-mono font-bold text-[var(--gold-primary)]">
                        {formatCurrency(barber.chairRentalFee || 0, currency)}
                        <span className="text-[10px] text-neutral-400 font-sans ml-1">
                          /{barber.chairRentalPeriod === 'daily' ? 'día' : barber.chairRentalPeriod === 'weekly' ? 'sem' : barber.chairRentalPeriod === 'biweekly' ? 'quincena' : 'mes'}
                        </span>
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-neutral-300">
                    <span className="text-neutral-500">Horario Laboral:</span>
                    <span className="font-mono text-white">{barber.workHours.start} - {barber.workHours.end}</span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-300">
                    <span className="text-neutral-500">Descanso / Almuerzo:</span>
                    <span className="font-mono text-neutral-400">{barber.breakTime ? `${barber.breakTime.start} - ${barber.breakTime.end}` : 'Sin descanso'}</span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-300">
                    <span className="text-neutral-500">Portafolio Fotográfico:</span>
                    <span className="font-mono text-[var(--gold-primary)]">{portfolioCount} de 10 fotos</span>
                  </div>
                </div>

                {/* Thumbnail Preview of Portfolio */}
                <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                  {barber.portfolio.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt="Trabajo"
                      className="w-12 h-12 rounded-lg object-cover border border-neutral-700 shrink-0"
                    />
                  ))}
                  {portfolioCount === 0 && (
                    <span className="text-[11px] text-neutral-500 italic">Sin fotos de portafolio aún</span>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-neutral-500 truncate">Cód: {barber.publicCode}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenDetail(barber)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--gold-primary)] text-black hover:bg-[var(--gold-hover)] text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Acuerdo & Finanzas</span>
                  </button>
                  <button
                    onClick={() => setSelectedBarber(barber)}
                    className="p-1.5 rounded-lg bg-[#202020] hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                    title="Gestionar Portafolio"
                  >
                    <Image className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Portfolio Manager Modal (Max 10 photos strictly enforced) */}
      {selectedBarber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <div>
                <h3 className="text-sm font-bold text-white">Portafolio: {selectedBarber.name}</h3>
                <p className="text-xs text-neutral-400">
                  Límite reglamentario: <strong className="text-[var(--gold-primary)] font-mono">{selectedBarber.portfolio.length} de 10 fotografías</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedBarber(null)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              {/* Add New Photo Input */}
              {selectedBarber.portfolio.length < 10 ? (
                <div className="p-4 bg-[#181818] rounded-2xl border border-neutral-800 space-y-2">
                  <span className="text-neutral-300 font-semibold block mb-1">Agregar fotografía al portafolio:</span>
                  <ImageUpload
                    value={newPhotoUrl}
                    onChange={(url) => {
                      if (url) handleAddPhoto(url);
                    }}
                    kind="portfolio"
                    tenantId={currentShop?.id}
                    aspectRatio="square"
                  />
                </div>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300">
                  Has alcanzado el límite máximo de 10 fotografías. Elimina una imagen para poder subir una nueva.
                </div>
              )}

              {/* Gallery Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 max-h-80 overflow-y-auto pr-1">
                {selectedBarber.portfolio.map((img, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden border border-neutral-700 aspect-square bg-neutral-900">
                    <img src={img} alt={`Portafolio ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemovePhoto(i)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                      title="Eliminar imagen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1.5 left-1.5 text-[9px] font-mono bg-black/60 px-1 rounded text-white">
                      #{i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-[#262626] flex justify-end">
              <button
                onClick={() => setSelectedBarber(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-white text-xs font-semibold hover:bg-neutral-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barber Detail & Contract Agreement Modal */}
      {detailBarber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-[#141414] border border-[#262626] rounded-3xl shadow-2xl p-6 my-8">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#262626]">
              <div className="flex items-center gap-3">
                <img
                  src={detailBarber.photo}
                  alt={detailBarber.name}
                  className="w-12 h-12 rounded-xl object-cover border border-[var(--gold-primary)]"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-white">{detailBarber.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      barberStatus === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {barberStatus === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Código: <span className="font-mono text-[var(--gold-primary)]">{detailBarber.publicCode}</span> · {detailBarber.phone || 'Sin teléfono'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailBarber(null)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Form */}
            <div className="py-5 space-y-6 text-xs">
              {/* Contract Modality Selection */}
              <div>
                <label className="text-xs font-bold text-neutral-200 block mb-2">
                  Modalidad de Trabajo y Liquidación
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setContractType('commission')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      contractType === 'commission'
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-white shadow-sm'
                        : 'border-neutral-800 bg-[#181818] text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-white">Comisión %</span>
                      {contractType === 'commission' && <Check className="w-3.5 h-3.5 text-[var(--gold-primary)]" />}
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-tight">
                      Porcentaje sobre cada servicio completado (ej. 50/50).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setContractType('chair_rental')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      contractType === 'chair_rental'
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-white shadow-sm'
                        : 'border-neutral-800 bg-[#181818] text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-white">Arriendo Silla</span>
                      {contractType === 'chair_rental' && <Check className="w-3.5 h-3.5 text-[var(--gold-primary)]" />}
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-tight">
                      Canon fijo periódico. El barbero conserva el 100% de sus cortes.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setContractType('hybrid')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      contractType === 'hybrid'
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-white shadow-sm'
                        : 'border-neutral-800 bg-[#181818] text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-white">Híbrido</span>
                      {contractType === 'hybrid' && <Check className="w-3.5 h-3.5 text-[var(--gold-primary)]" />}
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-tight">
                      Cuota base de arriendo reducida + porcentaje por servicio.
                    </p>
                  </button>
                </div>
              </div>

              {/* Dynamic Inputs according to contract type */}
              <div className="p-4 bg-[#181818] rounded-2xl border border-neutral-800 space-y-4">
                {(contractType === 'chair_rental' || contractType === 'hybrid') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                        Valor de Arriendo de la Silla ({currency}):
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-neutral-500 font-mono text-xs">$</span>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={chairRentalFee}
                          onChange={e => setChairRentalFee(Number(e.target.value))}
                          placeholder="Ej: 350000"
                          className="w-full bg-[#111] border border-neutral-700 rounded-xl pl-7 pr-3 py-2 text-white font-mono text-xs focus:border-[var(--gold-primary)] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-neutral-300 block mb-1">
                        Frecuencia de Cobro / Arriendo:
                      </label>
                      <select
                        value={chairRentalPeriod}
                        onChange={e => setChairRentalPeriod(e.target.value as any)}
                        className="w-full bg-[#111] border border-neutral-700 rounded-xl px-3 py-2 text-white text-xs focus:border-[var(--gold-primary)] focus:outline-none"
                      >
                        <option value="daily">Diario (al finalizar la jornada)</option>
                        <option value="weekly">Semanal (cada 7 días)</option>
                        <option value="biweekly">Quincenal (cada 15 días)</option>
                        <option value="monthly">Mensual (canon de mes)</option>
                      </select>
                    </div>
                  </div>
                )}

                {(contractType === 'commission' || contractType === 'hybrid') && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-neutral-300">
                        Porcentaje de Comisión para el Barbero:
                      </label>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        {commissionRate}% Barbero / {100 - commissionRate}% Barbería
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={commissionRate}
                      onChange={e => setCommissionRate(Number(e.target.value))}
                      className="w-full accent-[var(--gold-primary)] h-1.5 bg-neutral-700 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-neutral-500 font-mono mt-1">
                      <span>0%</span>
                      <span>30%</span>
                      <span>50%</span>
                      <span>70%</span>
                      <span>100%</span>
                    </div>
                  </div>
                )}

                {/* Status Switch */}
                <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
                  <div>
                    <span className="text-neutral-200 font-bold block text-xs">Estado Operativo</span>
                    <span className="text-[11px] text-neutral-400">Permite asignar citas y turnos en la barbería</span>
                  </div>
                  <select
                    value={barberStatus}
                    onChange={e => setBarberStatus(e.target.value as any)}
                    className="bg-[#111] border border-neutral-700 rounded-xl px-3 py-1.5 text-white text-xs font-semibold focus:border-[var(--gold-primary)]"
                  >
                    <option value="active">Activo y Operativo</option>
                    <option value="inactive">Inactivo / Pausado</option>
                  </select>
                </div>
              </div>

              {/* Financial Simulation / Projection */}
              <div className="p-4 bg-black/40 rounded-2xl border border-neutral-800/80">
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-[var(--gold-primary)] block mb-2">
                  Impacto Financiero Proyectado
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-[#161616] rounded-xl border border-neutral-800">
                    <span className="text-[11px] text-neutral-400 block mb-0.5">Ingreso para la Barbería:</span>
                    <div className="font-bold text-white text-xs">
                      {contractType === 'chair_rental' && (
                        <span>Canon fijo de <strong className="text-[var(--gold-primary)] font-mono">{formatCurrency(chairRentalFee, currency)}</strong> por periodo.</span>
                      )}
                      {contractType === 'commission' && (
                        <span>Recibe el <strong className="text-emerald-400 font-mono">{100 - commissionRate}%</strong> del valor de cada corte.</span>
                      )}
                      {contractType === 'hybrid' && (
                        <span>Arriendo <strong className="text-[var(--gold-primary)] font-mono">{formatCurrency(chairRentalFee, currency)}</strong> + <strong className="text-sky-400 font-mono">{100 - commissionRate}%</strong> por corte.</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-[#161616] rounded-xl border border-neutral-800">
                    <span className="text-[11px] text-neutral-400 block mb-0.5">Liquidación para el Barbero:</span>
                    <div className="font-bold text-white text-xs">
                      {contractType === 'chair_rental' && (
                        <span className="text-emerald-400">100% de sus servicios (tras cubrir su canon de silla).</span>
                      )}
                      {contractType === 'commission' && (
                        <span>Gana el <strong className="text-emerald-400 font-mono">{commissionRate}%</strong> de comisión neta por servicio.</span>
                      )}
                      {contractType === 'hybrid' && (
                        <span>Gana el <strong className="text-sky-400 font-mono">{commissionRate}%</strong> tras deducción de su base de arriendo.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-[#262626] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDetailBarber(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-white text-xs font-semibold hover:bg-neutral-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveContractAgreement}
                className="px-5 py-2 rounded-xl bg-[var(--gold-primary)] text-black font-extrabold text-xs hover:bg-[var(--gold-hover)] shadow-md flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Guardar Condiciones de Trabajo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

