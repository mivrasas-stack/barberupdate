import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { barberStore } from '../../services/store';
import { ImageUpload } from '../../components/common/ImageUpload';
import { isLiveBackend, updateBarberProfile, refreshLiveData } from '../../services/liveBackend';
import { Scissors, Star, QrCode, Image, Trash2, Plus, Copy, Printer, Edit2 } from 'lucide-react';

export const BarberoPerfil: React.FC = () => {
  const { currentBarber, state, addToast } = useApp();
  const barber = currentBarber || state.barbers.find(b => b.isIndependent) || state.barbers[0];
  const [newPhoto, setNewPhoto] = useState('');
  const [editingAvatar, setEditingAvatar] = useState(false);

  const handleUpdateAvatar = (url: string) => {
    if (!url) return;
    barberStore.updateBarber(barber.id, { photo: url });
    if (isLiveBackend && barber.businessId) {
      updateBarberProfile(barber.businessId, barber.id, { photoUrl: url })
        .then(() => refreshLiveData())
        .catch(e => console.error('Error actualizando foto de perfil del barbero:', e));
    }
    setEditingAvatar(false);
    addToast('Fotografía de perfil actualizada', 'success');
  };

  const handleAddPhoto = (urlToAdd?: string) => {
    const photoUrl = (urlToAdd || newPhoto).trim();
    if (!photoUrl) return;
    const res = barberStore.addPortfolioPhoto('barber', barber.id, photoUrl);
    if (!res.success) {
      addToast(res.error || 'Error al agregar foto', 'error');
      return;
    }

    if (isLiveBackend && barber.businessId) {
      const updatedPortfolio = [...barber.portfolio, photoUrl];
      updateBarberProfile(barber.businessId, barber.id, { portfolio: updatedPortfolio })
        .then(() => refreshLiveData())
        .catch(e => console.error('Error sincronizando portafolio barbero:', e));
    }

    addToast('Fotografía agregada a tu portafolio personal', 'success');
    setNewPhoto('');
  };

  const handleRemovePhoto = (idx: number) => {
    barberStore.removePortfolioPhoto('barber', barber.id, idx);

    if (isLiveBackend && barber.businessId) {
      const updatedPortfolio = barber.portfolio.filter((_, i) => i !== idx);
      updateBarberProfile(barber.businessId, barber.id, { portfolio: updatedPortfolio })
        .then(() => refreshLiveData())
        .catch(e => console.error('Error sincronizando portafolio barbero:', e));
    }

    addToast('Fotografía removida', 'info');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">
            Marca Personal
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Mi Perfil Profesional</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Tu vitrina digital para clientes particulares, portafolio y código QR
          </p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-center gap-6">
        <div className="relative group">
          <img
            src={barber.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'}
            alt={barber.name}
            className="w-24 h-24 rounded-2xl object-cover border-2 border-[var(--gold-primary)] shadow-xl"
          />
          <button
            onClick={() => setEditingAvatar(!editingAvatar)}
            className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-[var(--gold-primary)] text-black font-bold shadow-lg hover:bg-[var(--gold-hover)] cursor-pointer"
            title="Cambiar fotografía de perfil"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-center sm:text-left flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-white">{barber.name}</h2>
              <p className="text-xs text-[var(--gold-primary)] font-semibold mt-0.5">
                {barber.specialties.join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/40 border border-neutral-800 text-amber-400 text-xs font-mono font-bold self-center sm:self-auto">
              <Star className="w-4 h-4 fill-amber-400" />
              <span>{barber.rating} / 5.0</span>
              <span className="text-neutral-500 font-normal">({barber.reviewsCount})</span>
            </div>
          </div>
          <p className="text-xs text-neutral-300 mt-2 max-w-xl">{barber.bio}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-neutral-400 font-mono">
            <span>Tel: {barber.phone}</span>
            <span>·</span>
            <span>Horario: {barber.workHours.start} - {barber.workHours.end}</span>
            <span>·</span>
            <span className="text-[var(--gold-primary)] font-bold">Código QR: {barber.publicCode}</span>
          </div>

          {editingAvatar && (
            <div className="mt-4 p-4 rounded-2xl bg-[#181818] border border-neutral-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-neutral-300 font-semibold text-xs">Actualizar foto de perfil</span>
                <button
                  type="button"
                  onClick={() => setEditingAvatar(false)}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300"
                >
                  Cerrar
                </button>
              </div>
              <ImageUpload
                value={barber.photo}
                onChange={handleUpdateAvatar}
                kind="avatar"
                tenantId={barber.businessId}
                aspectRatio="square"
              />
            </div>
          )}
        </div>
      </div>

      {/* Portfolio with strict 10 photo limit */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div>
            <h3 className="text-sm font-bold text-white">Mi Portafolio de Cortes & Trabajos</h3>
            <p className="text-xs text-neutral-400">Tus clientes verán estas imágenes al agendar contigo</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#1e1e1e] text-[var(--gold-primary)] border border-neutral-700">
            {barber.portfolio.length} de 10 fotografías
          </span>
        </div>

        {barber.portfolio.length < 10 ? (
          <div className="p-4 bg-[#181818] rounded-2xl border border-neutral-800/80 space-y-2">
            <span className="text-neutral-300 font-semibold block mb-2 text-xs">Agregar fotografía a mi portafolio:</span>
            <div className="max-w-xl">
              <ImageUpload
                value={newPhoto}
                onChange={(url) => {
                  if (url) handleAddPhoto(url);
                }}
                kind="portfolio"
                tenantId={barber.businessId}
                aspectRatio="auto"
              />
            </div>
          </div>
        ) : (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300">
            Límite máximo de 10 fotos completado. Elimina una para añadir otra.
          </div>
        )}

        {/* Photos Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {barber.portfolio.map((img, i) => (
            <div key={i} className="relative group rounded-xl overflow-hidden aspect-square border border-neutral-800 bg-neutral-900">
              <img src={img} alt={`Trabajo ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              <button
                onClick={() => handleRemovePhoto(i)}
                className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 text-red-400 hover:bg-red-500 hover:text-white"
                title="Eliminar foto"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <span className="absolute bottom-1.5 left-1.5 text-[10px] font-mono bg-black/60 px-1 rounded text-white">
                #{i + 1}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
