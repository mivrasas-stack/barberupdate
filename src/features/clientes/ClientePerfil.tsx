import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, Phone, Mail, Award, Calendar, Scissors, ShieldCheck, Camera, Edit2 } from 'lucide-react';
import { ImageUpload } from '../../components/common/ImageUpload';
import { isLiveBackend, updateCustomerProfile } from '../../services/liveBackend';

export const ClientePerfil: React.FC = () => {
  const { currentUser, state, setCurrentUser, addToast } = useApp();
  const customerId = currentUser?.id || 'usr-client-1';
  const loyalty = state.loyalty[customerId] || state.loyalty['usr-client-1'] || { points: 420 };
  const [editingAvatar, setEditingAvatar] = useState(false);

  const handleUpdateAvatar = async (url: string) => {
    if (!url || !currentUser) return;
    const updated = { ...currentUser, avatar: url };
    setCurrentUser(updated);

    if (isLiveBackend) {
      try {
        await updateCustomerProfile({ avatarUrl: url });
        addToast('Foto de perfil actualizada en el backend', 'success');
      } catch (e) {
        console.error('Error actualizando avatar de cliente:', e);
      }
    } else {
      addToast('Foto de perfil actualizada', 'success');
    }
    setEditingAvatar(false);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center pb-4 border-b border-[#242424]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
          Configuración Personal
        </span>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Mi Perfil de Cliente</h1>
      </div>

      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80'}
              alt={currentUser?.name || 'Cliente'}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-[var(--gold-primary)]"
            />
            <button
              onClick={() => setEditingAvatar(!editingAvatar)}
              className="absolute -bottom-1 -right-1 p-1 rounded-lg bg-[var(--gold-primary)] text-black font-bold shadow-md hover:bg-[var(--gold-hover)] cursor-pointer"
              title="Cambiar foto de perfil"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">{currentUser?.name || 'Camilo Andrés Torres'}</h2>
            <p className="text-xs text-neutral-400">{currentUser?.email || 'camilo.torres@gmail.com'}</p>
            <div className="mt-1 flex items-center gap-2 text-xs font-mono text-neutral-300">
              <span>{currentUser?.phone || '+57 311 222 3344'}</span>
              <span>·</span>
              <span className="text-[var(--gold-primary)] font-bold">{loyalty.points} pts acumulados</span>
            </div>
          </div>
        </div>

        {editingAvatar && (
          <div className="p-4 rounded-xl bg-[#181818] border border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-300 font-semibold text-xs">Subir nueva foto de perfil</span>
              <button
                type="button"
                onClick={() => setEditingAvatar(false)}
                className="text-[10px] text-neutral-500 hover:text-neutral-300"
              >
                Cerrar
              </button>
            </div>
            <ImageUpload
              value={currentUser?.avatar || ''}
              onChange={handleUpdateAvatar}
              kind="avatar"
              aspectRatio="square"
            />
          </div>
        )}
      </div>

      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 space-y-3 text-xs">
        <h3 className="text-sm font-bold text-white">Preferencias de Corte</h3>
        <p className="text-neutral-400">
          Guardamos tus preferencias para que cualquier barbero de la plataforma conozca tu estilo:
        </p>
        <div className="p-3 bg-[#181818] rounded-xl border border-neutral-800 space-y-1.5 text-neutral-300">
          <div>• Estilo habitual: <strong>Degradado medio con navaja (Skin Fade)</strong></div>
          <div>• Longitud superior: <strong>Tijera textura media, peinado hacia atrás</strong></div>
          <div>• Barba: <strong>Perfilado de líneas con toalla caliente y loción sin alcohol</strong></div>
        </div>
      </div>
    </div>
  );
};
