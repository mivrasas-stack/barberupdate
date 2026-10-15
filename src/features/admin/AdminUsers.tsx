import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, UserRole } from '../../types';
import {
  Search,
  Filter,
  UserCheck,
  Shield,
  Store,
  Scissors,
  Users,
  Eye,
  Edit,
  X,
  CheckCircle,
  Ban,
  Calendar,
  Mail,
  Phone,
  Building,
} from 'lucide-react';

export const AdminUsers: React.FC = () => {
  const { state, addToast } = useApp();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<User>>({});

  // Filter users
  const filteredUsers = state.users.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.phone.includes(search);
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleOpenDetail = (user: User) => {
    setSelectedUser(user);
    setEditForm(user);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (!selectedUser) return;
    const idx = state.users.findIndex(u => u.id === selectedUser.id);
    if (idx >= 0) {
      state.users[idx] = { ...state.users[idx], ...editForm };
      setSelectedUser(state.users[idx]);
      setIsEditing(false);
      addToast('Información de usuario actualizada exitosamente', 'success');
    }
  };

  const handleToggleStatus = () => {
    if (!selectedUser) return;
    const newStatus = selectedUser.status === 'active' ? 'suspended' : 'active';
    const idx = state.users.findIndex(u => u.id === selectedUser.id);
    if (idx >= 0) {
      state.users[idx].status = newStatus;
      setSelectedUser({ ...state.users[idx] });
      addToast(`Estado del usuario cambiado a: ${newStatus}`, 'info');
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'superadmin':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Superadmin</span>;
      case 'owner':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#D9A323]/15 text-[#D9A323] border border-[#D9A323]/30">Propietario Barbería</span>;
      case 'barber_employee':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">Barbero</span>;
      case 'client':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Cliente Registrado</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Directorio Central
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Gestión de Usuarios</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Administra propietarios, barberos, clientes y personal con roles granulares
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-[#141414] border border-[#262626] rounded-2xl p-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, correo o teléfono..."
            className="w-full bg-[#181818] border border-[#2a2a2a] rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[var(--gold-primary)] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="bg-[#181818] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-[var(--gold-primary)] cursor-pointer"
          >
            <option value="all">Todos los roles</option>
            <option value="owner">Propietario de Barbería</option>
            <option value="barber_employee">Barbero Asociado</option>
            <option value="client">Cliente</option>
            <option value="superadmin">Superadmin</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#181818] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-[var(--gold-primary)] cursor-pointer"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activo</option>
            <option value="suspended">Suspendido</option>
            <option value="pending">Pendiente</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#262626] bg-[#181818] text-neutral-400">
                <th className="py-3.5 px-4 font-semibold">Usuario</th>
                <th className="py-3.5 px-4 font-semibold">Tipo de Cuenta</th>
                <th className="py-3.5 px-4 font-semibold">Negocio Asociado</th>
                <th className="py-3.5 px-4 font-semibold">Plan</th>
                <th className="py-3.5 px-4 font-semibold">Estado</th>
                <th className="py-3.5 px-4 font-semibold">Registro</th>
                <th className="py-3.5 px-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e]">
              {filteredUsers.map(user => {
                const shop = state.barbershops.find(s => s.id === user.businessId);
                const plan = state.plans.find(p => p.id === user.planId);

                return (
                  <tr key={user.id} className="hover:bg-[#181818] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-9 h-9 rounded-full object-cover border border-neutral-700"
                        />
                        <div>
                          <div className="font-bold text-white">{user.name}</div>
                          <div className="text-[11px] text-neutral-400">{user.email}</div>
                          <div className="text-[10px] text-neutral-500 font-mono">{user.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">{getRoleBadge(user.role)}</td>
                    <td className="py-3 px-4 text-neutral-300">
                      {shop ? (
                        <span className="font-medium text-white">{shop.name}</span>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {plan ? (
                        <span className="text-neutral-200 font-medium">{plan.name}</span>
                      ) : (
                        <span className="text-neutral-500">Gratuito</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {user.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                          <CheckCircle className="w-3 h-3" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-red-400">
                          <Ban className="w-3 h-3" /> Suspendido
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-400 text-[11px]">{user.createdAt}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenDetail(user)}
                        className="px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[var(--gold-primary)] hover:text-black font-semibold text-neutral-200 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ficha Detalle</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col justify-between">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
              <div className="flex items-center gap-3">
                <img
                  src={selectedUser.avatar}
                  alt={selectedUser.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-[var(--gold-primary)]"
                />
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedUser.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {getRoleBadge(selectedUser.role)}
                    <span className="text-xs text-neutral-400">ID: {selectedUser.id}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-4 space-y-4 overflow-y-auto pr-1">
              {isEditing ? (
                /* Edit Mode */
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      value={editForm.email || ''}
                      onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">Teléfono</label>
                    <input
                      type="text"
                      value={editForm.phone || ''}
                      onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-[#181818] border border-[#262626]">
                    <span className="text-[10px] font-semibold uppercase text-neutral-500 block mb-1">Contacto</span>
                    <div className="flex items-center gap-2 text-neutral-300 text-xs mb-1">
                      <Mail className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{selectedUser.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-300 text-xs">
                      <Phone className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{selectedUser.phone}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#181818] border border-[#262626]">
                    <span className="text-[10px] font-semibold uppercase text-neutral-500 block mb-1">Actividad</span>
                    <div className="flex items-center gap-2 text-neutral-300 text-xs mb-1">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Alta: {selectedUser.createdAt}</span>
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      Último ingreso: <span className="text-neutral-200">{selectedUser.lastLogin}</span>
                    </div>
                  </div>

                  {selectedUser.businessId && (
                    <div className="sm:col-span-2 p-3 rounded-xl bg-[#181818] border border-[#262626]">
                      <span className="text-[10px] font-semibold uppercase text-neutral-500 block mb-1">Entidad Vinculada</span>
                      <div className="flex items-center gap-2 text-xs text-white font-medium">
                        <Building className="w-4 h-4 text-[var(--gold-primary)]" />
                        <span>
                          {state.barbershops.find(s => s.id === selectedUser.businessId)?.name || 'Barbería Registrada'}
                        </span>
                      </div>
                    </div>
                  )}

                  {selectedUser.planId && (
                    <div className="sm:col-span-2 p-3 rounded-xl bg-[#181818] border border-[#262626]">
                      <span className="text-[10px] font-semibold uppercase text-neutral-500 block mb-1">Suscripción SaaS</span>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white font-semibold">
                          {state.plans.find(p => p.id === selectedUser.planId)?.name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Al día (Renovación mensual)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-[#262626] flex items-center justify-between">
              <button
                onClick={handleToggleStatus}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-1.5 ${
                  selectedUser.status === 'active'
                    ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                    : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                {selectedUser.status === 'active' ? (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>Suspender Usuario</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Activar Usuario</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--gold-primary)] text-black hover:bg-[var(--gold-hover)]"
                    >
                      Guardar Cambios
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#242424] text-white hover:bg-[#303030] flex items-center gap-1.5"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Editar Ficha</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
