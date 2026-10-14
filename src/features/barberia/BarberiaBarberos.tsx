import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Barber } from '../../types';
import { barberStore } from '../../services/store';
import { ImageUploader } from './ImageUploader';
import { BarberInvites } from './BarberInvites';
import {backendRequest,isLiveBackend,refreshLiveData} from '../../services/liveBackend';
import { Scissors, Plus, Star, Phone, Mail, Clock, Calendar, Image, X, Check, Trash2 } from 'lucide-react';

export const BarberiaBarberos: React.FC = () => {
  const { currentShop, state, addToast } = useApp();
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [showInvites, setShowInvites] = useState(false);

  const shopId = currentShop?.id || 'shop-1';
  const barbers = state.barbers.filter(b => b.businessId === shopId);

  const updatePortrait=async(barberId:string,url:string)=>{
    try{
      await backendRequest('/tenants/'+shopId+'/barbers/'+barberId+'/photo',{method:'PATCH',body:JSON.stringify({url})});
      await refreshLiveData();
      addToast('Fotografía del barbero actualizada','success');
    }catch(e){addToast(e instanceof Error?e.message:'No se guardó el retrato','error');}
  };

  const handleAddPhoto = async (photoUrl=newPhotoUrl) => {
    if(isLiveBackend){
      if(!selectedBarber||!photoUrl)return;
      try{await backendRequest('/tenants/'+shopId+'/barbers/'+selectedBarber.id+'/gallery',{method:'PATCH',body:JSON.stringify({photos:[...selectedBarber.portfolio,photoUrl]})});await refreshLiveData();setSelectedBarber({...selectedBarber,portfolio:[...selectedBarber.portfolio,photoUrl]});setNewPhotoUrl('');addToast('Portafolio actualizado','success');}
      catch(e){addToast(e instanceof Error?e.message:'No se guardó la foto','error');}
      return;
    }
    if (!selectedBarber || !newPhotoUrl) return;
    const res = barberStore.addPortfolioPhoto('barber', selectedBarber.id, newPhotoUrl);
    if (!res.success) {
      addToast(res.error || 'Error al añadir foto', 'error');
      return;
    }
    addToast('Fotografía agregada al portafolio profesional', 'success');
    setNewPhotoUrl('');
    // Refresh local selected
    const updated = state.barbers.find(b => b.id === selectedBarber.id);
    if (updated) setSelectedBarber({ ...updated });
  };

  const handleRemovePhoto = async (index: number) => {
    if(isLiveBackend){
      if(!selectedBarber)return;
      const photos=selectedBarber.portfolio.filter((_,i)=>i!==index);
      try{await backendRequest('/tenants/'+shopId+'/barbers/'+selectedBarber.id+'/gallery',{method:'PATCH',body:JSON.stringify({photos})});await refreshLiveData();setSelectedBarber({...selectedBarber,portfolio:photos});addToast('Fotografía eliminada','success');}
      catch(e){addToast(e instanceof Error?e.message:'No se eliminó la foto','error');}
      return;
    }
    if (!selectedBarber) return;
    barberStore.removePortfolioPhoto('barber', selectedBarber.id, index);
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
        {isLiveBackend && <button type="button" onClick={()=>setShowInvites(value=>!value)} className="rounded-xl bg-[var(--gold-primary)] text-black font-bold px-4 py-2 text-sm">{showInvites?'Ocultar invitaciones':'Añadir barbero'}</button>}
      </div>
      {showInvites && isLiveBackend && <BarberInvites/>}

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
                    src={barber.photo || '/images/placeholder.svg'} onError={e=>{if(!e.currentTarget.src.endsWith('/images/placeholder.svg'))e.currentTarget.src='/images/placeholder.svg';}}
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

                {isLiveBackend && <div className="mb-3"><ImageUploader tenant={shopId} category="barber" label="Actualizar foto de perfil" onUploaded={url=>void updatePortrait(barber.id,url)}/></div>}
                <div className="p-3 bg-[#181818] rounded-xl border border-neutral-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-neutral-300">
                    <span className="text-neutral-500">Comisión por Servicio:</span>
                    <span className="font-mono font-bold text-emerald-400">{(barber.commissionRate * 100).toFixed(0)}%</span>
                  </div>
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
                      src={img} onError={e=>{if(!e.currentTarget.src.endsWith('/images/placeholder.svg'))e.currentTarget.src='/images/placeholder.svg';}}
                      alt="Trabajo"
                      className="w-12 h-12 rounded-lg object-cover border border-neutral-700 shrink-0"
                    />
                  ))}
                  {portfolioCount === 0 && (
                    <span className="text-[11px] text-neutral-500 italic">Sin fotos de portafolio aún</span>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
                <span className="text-[11px] font-mono text-neutral-500">Código: {barber.publicCode}</span>
                <button
                  onClick={() => setSelectedBarber(barber)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#202020] hover:bg-[var(--gold-primary)] hover:text-black text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
                >
                  <Image className="w-3.5 h-3.5" />
                  <span>Gestionar Portafolio ({portfolioCount}/10)</span>
                </button>
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
                <div className="p-3 bg-[#181818] rounded-xl border border-neutral-800 space-y-2">
                  <span className="text-neutral-300 font-semibold block">Subir enlace de fotografía de trabajo realizado:</span>
                  {isLiveBackend && <ImageUploader tenant={shopId} category="barber" onUploaded={u=>void handleAddPhoto(u)}/>}
                  {!isLiveBackend && <div className="flex gap-2">
                    <input
                      type="url"
                      value={newPhotoUrl}
                      onChange={e => setNewPhotoUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-white"
                    />
                    <button
                      onClick={()=>void handleAddPhoto()}
                      className="px-4 py-1.5 rounded-lg bg-[var(--gold-primary)] text-black font-bold hover:bg-[var(--gold-hover)]"
                    >
                      Añadir
                    </button>
                  </div>}
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
                    <img src={img} onError={e=>{if(!e.currentTarget.src.endsWith('/images/placeholder.svg'))e.currentTarget.src='/images/placeholder.svg';}} alt={`Portafolio ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => void handleRemovePhoto(i)}
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
    </div>
  );
};
