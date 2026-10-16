import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { backendRequest } from '../../services/liveBackend';
import { UserRole } from '../../types';

const field='w-full bg-[#181818] border border-[#363636] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)]';
type ShopItem={id:string;name:string};
export const CreateUserModal:React.FC<{shops:ShopItem[];onClose:()=>void;onCreated:()=>void}>=({shops,onClose,onCreated})=>{
  const {addToast}=useApp();
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [phone,setPhone]=useState('');
  const [role,setRole]=useState<Exclude<UserRole,'superadmin'>>('client');
  const [tenantId,setTenantId]=useState('');
  const [busy,setBusy]=useState(false);
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(role==='barber_employee'&&!tenantId){addToast('Selecciona una barbería para el barbero','error');return;}
    setBusy(true);
    try{
      await backendRequest('/platform/users',{method:'POST',body:JSON.stringify({
        name:name.trim(),email:email.trim().toLowerCase(),phone:phone.trim(),role,
        ...(role!=='client'&&tenantId?{tenantId}:{})
      })});
      addToast('Invitación enviada. La cuenta podrá activarse desde el correo.','success');
      onCreated();
      onClose();
    }catch(err){addToast(err instanceof Error?err.message:'No se pudo invitar al usuario','error');}
    finally{setBusy(false);}
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Crear usuario">
      <form onSubmit={save} className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#141414] border border-[#303030] rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3"><div>
          <h2 className="text-lg font-bold text-white">Nuevo usuario</h2>
          <p className="text-xs text-neutral-400 mt-1">Alta segura mediante invitación a su correo, sin contraseñas compartidas.</p>
        </div><button type="button" onClick={onClose} aria-label="Cerrar" className="text-neutral-400 hover:text-white"><X size={20}/></button></div>
        <label className="block text-xs text-neutral-300">Nombre completo *
          <input className={field} required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre y apellido"/>
        </label>
        <label className="block text-xs text-neutral-300">Correo de acceso *
          <input className={field} type="email" required maxLength={150} value={email} onChange={e=>setEmail(e.target.value)} placeholder="persona@correo.com"/>
        </label>
        <label className="block text-xs text-neutral-300">Teléfono
          <input className={field} type="tel" maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+57 300 000 0000"/>
        </label>
        <label className="block text-xs text-neutral-300">Tipo de cuenta *
          <select className={field} value={role} onChange={e=>{setRole(e.target.value as Exclude<UserRole,'superadmin'>);setTenantId('');}}>
            <option value="client">Cliente</option>
            <option value="owner">Propietario</option>
            <option value="barber_employee">Barbero</option>
          </select>
        </label>
        {role!=='client'&&<label className="block text-xs text-neutral-300">Barbería {role==='barber_employee'?'*':'(opcional)'}
          <select className={field} value={tenantId} required={role==='barber_employee'} onChange={e=>setTenantId(e.target.value)}>
            <option value="">{role==='owner'?'Sin asociar (crear la sede después)':'Seleccionar barbería'}</option>
            {shops.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {role==='owner'&&<span className="text-neutral-500 block mt-1">Puedes crear la barbería y asignar el propietario desde Franquicias & Barberías.</span>}
        </label>}
        <div className="bg-[#1d1d1d] border border-[#333] rounded-xl p-3 text-xs text-neutral-400">
          {role==='barber_employee'?'Se creará también el perfil profesional con horario inicial lunes a sábado, 9:00 a 18:00.':role==='owner'?'El propietario conservará acceso administrativo. Podrá habilitarse también como barbero desde su equipo.':'El cliente podrá reservar tras aceptar su invitación.'}
          {' '}El envío depende del correo configurado en Supabase.
        </div>
        <div className="flex justify-end gap-3 pt-3 border-t border-[#303030]">
          <button type="button" onClick={onClose} disabled={busy} className="text-sm px-4 py-2 text-neutral-300">Cancelar</button>
          <button type="submit" disabled={busy} className="text-sm font-bold px-5 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black disabled:opacity-50">{busy?'Enviando...':'Enviar invitación'}</button>
        </div>
      </form>
    </div>
  );
};
