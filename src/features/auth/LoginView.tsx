import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Scissors, Shield, Store, UserCheck, Users, ArrowRight, Lock, Mail, Sparkles, CheckCircle2 } from 'lucide-react';
import { UserRole } from '../../types';

export const LoginView: React.FC = () => {
  const { state, loginAs, setIsPaletteModalOpen } = useApp();
  const [email, setEmail] = useState('contacto@barberclub.co');
  const [password, setPassword] = useState('••••••••••••');
  const [selectedRole, setSelectedRole] = useState<UserRole>('owner');

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = state.users.find(u => u.email === email) || state.users.find(u => u.role === selectedRole) || state.users[1];
    loginAs(user);
  };

  const personas = [
    {
      role: 'owner' as UserRole,
      title: 'Propietario de Barbería',
      name: 'Mateo Restrepo',
      business: 'Barber Club Bogotá (Chicó)',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      badge: 'Multi-Silla & Empleados',
      icon: <Store className="w-4 h-4 text-[var(--gold-primary)]" />,
      targetPath: '/barberia/barber-club/dashboard',
    },
    {
      role: 'barber_independent' as UserRole,
      title: 'Barbero Independiente',
      name: 'Alex "The Blade" Fade',
      business: 'Estudio Privado (VIP 1 a 1)',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
      badge: 'Autónomo & Boutique',
      icon: <Scissors className="w-4 h-4 text-orange-400" />,
      targetPath: '/barbero/alex-fade/dashboard',
    },
    {
      role: 'client' as UserRole,
      title: 'Portal de Clientes',
      name: 'Camilo Andrés Torres',
      business: 'Cliente Frecuente (420 pts)',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
      badge: 'Reservas & Sala de Espera',
      icon: <UserCheck className="w-4 h-4 text-emerald-400" />,
      targetPath: '/clientes/dashboard',
    },
    {
      role: 'superadmin' as UserRole,
      title: 'Superadministrador',
      name: 'Carlos Mendoza',
      business: 'Control Global de Plataforma',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      badge: 'Franquicias & Planes MRR',
      icon: <Shield className="w-4 h-4 text-amber-400" />,
      targetPath: '/admin/dashboard',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 text-[var(--text-primary)] relative overflow-hidden">
      {/* Apple-style Multi-Layer Ambient Depth Glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-[radial-gradient(ellipse_at_center,rgba(217,163,35,0.12)_0%,transparent_70%)] blur-[90px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[-5%] w-[600px] h-[350px] bg-[radial-gradient(ellipse_at_center,rgba(217,163,35,0.06)_0%,transparent_70%)] blur-[80px] rounded-full pointer-events-none" />

      {/* Brand Header */}
      <div className="text-center mb-10 relative z-10 animate-apple-enter">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-b from-[#f5c754] to-[#b88928] text-black mb-4 shadow-[0_10px_30px_rgba(217,163,35,0.35),inset_0_1px_2px_rgba(255,255,255,0.7)] ring-1 ring-white/30">
          <Scissors className="w-8 h-8 rotate-45" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Barber<span className="text-[var(--gold-primary)]">OS</span>
        </h1>
        <p className="mt-2 text-sm text-neutral-400 max-w-md mx-auto font-medium">
          Plataforma SaaS Integral de Gestión Comercial para Barberías, Barberos Independientes y Clientes
        </p>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 animate-apple-enter">
        {/* Left Card: 1-Click Persona Quick Logins */}
        <div className="lg:col-span-7 bg-[#141418]/80 backdrop-blur-2xl border border-white/[0.1] rounded-3xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.12)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold-primary)]">
                  Acceso Rápido de Demostración
                </span>
                <h2 className="text-xl font-extrabold text-white mt-0.5">Elige el perfil para ingresar</h2>
              </div>
              <button
                onClick={() => setIsPaletteModalOpen(true)}
                className="text-xs text-neutral-300 hover:text-[var(--gold-primary)] transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] hover:border-white/20 active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                <span>Paleta</span>
              </button>
            </div>

            <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
              Cada perfil cuenta con su propio layout, permisos visuales y base de datos relacional integrada:
            </p>

            <div className="space-y-3">
              {personas.map(p => {
                const targetUser = state.users.find(u => u.role === p.role) || state.users[0];
                return (
                  <button
                    key={p.role}
                    onClick={() => loginAs(targetUser)}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.07] hover:border-[var(--gold-primary)]/50 transition-all duration-200 group text-left cursor-pointer shadow-sm hover:shadow-[0_10px_25px_rgba(0,0,0,0.4),0_0_20px_rgba(217,163,35,0.1)] active:scale-[0.985]"
                  >
                    <div className="flex items-center gap-3.5">
                      <img
                        src={p.avatar}
                        alt={p.name}
                        className="w-11 h-11 rounded-2xl object-cover ring-2 ring-white/10 group-hover:ring-[var(--gold-primary)]/60 transition-all"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white group-hover:text-[var(--gold-primary)] transition-colors">
                            {p.title}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-neutral-300 border border-white/[0.08] font-medium">
                            {p.badge}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-300 font-medium mt-0.5">{p.name}</div>
                        <div className="text-[11px] text-neutral-500">{p.business}</div>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-white/[0.06] group-hover:bg-[var(--gold-primary)] text-neutral-400 group-hover:text-black flex items-center justify-center transition-all shrink-0 shadow-inner">
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-neutral-400">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Adaptadores tipados listos para backend
            </span>
            <span className="font-mono text-neutral-500">v1.0.0 Apple UI</span>
          </div>
        </div>

        {/* Right Card: Manual Simulation Login Form */}
        <div className="lg:col-span-5 bg-[#141418]/80 backdrop-blur-2xl border border-white/[0.1] rounded-3xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.12)] flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold-primary)]">
              Formulario de Acceso
            </span>
            <h3 className="text-xl font-extrabold text-white mt-1 mb-1">Iniciar Sesión</h3>
            <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
              Ingresa tus credenciales o selecciona un rol para simular la autenticación.
            </p>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-neutral-300 block mb-1.5 font-semibold">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--gold-primary)] focus:bg-white/[0.07] transition-all shadow-inner"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-300 block mb-1.5 font-semibold">Contraseña</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--gold-primary)] focus:bg-white/[0.07] transition-all shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-300 block mb-1.5 font-semibold">Rol Asignado</label>
                <select
                  value={selectedRole}
                  onChange={e => {
                    const r = e.target.value as UserRole;
                    setSelectedRole(r);
                    const matched = state.users.find(u => u.role === r);
                    if (matched) setEmail(matched.email);
                  }}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--gold-primary)] focus:bg-white/[0.07] transition-all cursor-pointer shadow-inner"
                >
                  <option value="owner" className="bg-[#18181b] text-white">Propietario de Barbería (Barber Club)</option>
                  <option value="barber_independent" className="bg-[#18181b] text-white">Barbero Independiente (Alex Fade)</option>
                  <option value="client" className="bg-[#18181b] text-white">Cliente (Camilo Torres)</option>
                  <option value="superadmin" className="bg-[#18181b] text-white">Superadministrador (Global)</option>
                  <option value="barber_employee" className="bg-[#18181b] text-white">Barbero Asociado (Santiago)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 rounded-2xl apple-button-gold text-black font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Entrar al Sistema
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.08] text-[11px] text-neutral-400 text-center font-medium">
            Modo simulación activo. Acceso instantáneo sin contraseñas.
          </div>
        </div>
      </div>
    </div>
  );
};
