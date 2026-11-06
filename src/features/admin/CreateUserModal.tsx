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
  const [inviteUrl,setInviteUrl]=useState('');
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(role==='barber_employee'&&!tenantId){addToast('Selecciona una barbería para el barbero','error');return;}
    setBusy(true);
    try{
      const response=await backendRequest<{inviteUrl?:string}>('/platform/users',{method:'POST',body:JSON.stringify({
        name:name.trim(),email:email.trim().toLowerCase(),phone:phone.trim(),role,
        ...(role!=='client'&&tenantId?{tenantId}:{})
      })});
      if(!response.inviteUrl)throw Error('No se generó el enlace para completar la invitación.');
      setInviteUrl(response.inviteUrl);
      addToast('Código de invitación solicitado por WhatsApp. Comparte el enlace con el usuario.','success');
      onCreated();
    }catch(err){addToast(err instanceof Error?err.message:'No se pudo invitar al usuario','error');}
    finally{setBusy(false);}
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Crear usuario">
      <form onSubmit={save} className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#141414] border border-[#303030] rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3"><div>
          <h2 className="text-lg font-bold text-white">Nuevo usuario</h2>
          <p className="text-xs text-neutral-400 mt-1">La persona recibe un código por WhatsApp y configura su propia contraseña. No necesita correo SMTP.</p>
        </div><button type="button" onClick={onClose} aria-label="Cerrar" className="text-neutral-400 hover:text-white"><X size={20}/></button></div>
        <label className="block text-xs text-neutral-300">Nombre completo *
          <input className={field} required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre y apellido"/>
        </label>
        <label className="block text-xs text-neutral-300">Correo de acceso *
          <input className={field} type="email" required maxLength={150} value={email} onChange={e=>setEmail(e.target.value)} placeholder="persona@correo.com"/>
        </label>
        <label className="block text-xs text-neutral-300">Celular de WhatsApp *
          <input className={field} required type="tel" maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="3001234567"/>
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
          {' '}No requiere SMTP ni configuración de la barbería: se utiliza la cuenta central de WhatsApp.
        </div>
        {inviteUrl&&<div className="rounded-xl border border-emerald-700/60 bg-emerald-950/20 p-4 space-y-3">
          <h3 className="font-bold text-sm text-emerald-300">Invitación preparada</h3>
          <p className="text-xs text-neutral-300">El código se solicitó por WhatsApp. Comparte este enlace con la persona invitada. La persona debe tener ambos para activar su cuenta; el código expira en 5 minutos.</p>
          <input className={field} readOnly value={inviteUrl} aria-label="Enlace para activar usuario"/>
          <button type="button" onClick={()=>void navigator.clipboard.writeText(inviteUrl).then(()=>
            addToast('Enlace copiado','success')).catch(()=>addToast('Selecciona el enlace y cópialo manualmente.','info'))}
            className="rounded-lg border border-emerald-600 px-3 py-2 text-xs text-white">Copiar enlace</button>
        </div>}
        <div className="flex justify-end gap-3 pt-3 border-t border-[#303030]">
          <button type="button" onClick={onClose} disabled={busy} className="text-sm px-4 py-2 text-neutral-300">Cancelar</button>
          {!inviteUrl&&<button type="submit" disabled={busy} className="text-sm font-bold px-5 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black disabled:opacity-50">{busy?'Enviando...':'Enviar invitación'}</button>}
          {inviteUrl&&<button type="button" onClick={onClose} className="text-sm font-bold px-5 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black">Terminar</button>}
        </div>
      </form>
    </div>
  );
};

[executed on device: vmi3669516 (22a9c8cd-8866-4186-9071-dab9301dff16)]