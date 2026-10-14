import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, Plus, Mail, Check, X, Lock } from 'lucide-react';
import { User } from '../../types';

export const AdminAdministrators: React.FC = () => {
  const { state, addToast } = useApp();
  const superadmins = state.users.filter(u => u.role === 'superadmin');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');

  const handleCreateAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName) return;
    const newAdmin: User = {
      id: `usr-admin-${Date.now()}`,
      name: inviteName,
      email: inviteEmail,
      phone: '+57 300 123 4567',
      role: 'superadmin',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      createdAt: new Date().toISOString().split('T')[0],
      lastLogin: 'Recién creado',
      status: 'active',
    };
    state.users.push(newAdmin);
    setIsInviteModalOpen(false);
    setInviteEmail('');
    setInviteName('');
    addToast(`Administrador ${newAdmin.name} agregado con éxito`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Seguridad & Gobernanza
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Administradores de la Plataforma</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Usuarios con permisos globales para gestionar franquicias, suscripciones y configuración comercial
          </p>
        </div>

        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black text-xs font-bold hover:bg-[var(--gold-hover)] transition-all shadow-lg shadow-[var(--gold-primary)]/10"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Administrador</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {superadmins.map(admin => (
          <div key={admin.id} className="bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <img
                src={admin.avatar}
                alt={admin.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-[var(--gold-primary)]"
              />
              <div>
                <h3 className="text-sm font-bold text-white">{admin.name}</h3>
                <p className="text-xs text-neutral-400">{admin.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Acceso Total (Superadmin)
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-neutral-800 text-xs">
              <div className="text-[11px] text-neutral-500 uppercase font-semibold">Permisos Habilitados:</div>
              <div className="flex items-center gap-2 text-neutral-300">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Gestión de Franquicias y Barberías</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-300">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cobro y Monitoreo de Suscripciones</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-300">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Publicación en Editor de Precios</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-300">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Suspensión y Auditoría de Cuentas</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-800 text-[11px] text-neutral-500 flex justify-between">
              <span>Último acceso:</span>
              <span className="text-neutral-300 font-mono">{admin.lastLogin}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <h3 className="text-sm font-bold text-white">Registrar Administrador de Plataforma</h3>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="py-4 space-y-3 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="Ej. Andrés Morales"
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="admin@barberos.co"
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[var(--gold-primary)] text-black font-bold"
                >
                  Confirmar Alta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
