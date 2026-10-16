import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { backendRequest, refreshLiveData } from '../../services/liveBackend';
import { User } from '../../types';

const field='w-full bg-[#181818] border border-[#363636] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)]';
const cleanSlug=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70);

export const CreateBarbershopModal: React.FC<{onClose:()=>void}> = ({onClose}) => {
  const {addToast}=useApp();
  const [users,setUsers]=useState<User[]>([]);
  const [loadingUsers,setLoadingUsers]=useState(true);
  const [busy,setBusy]=useState(false);
  const [name,setName]=useState('');
  const [slug,setSlug]=useState('');
  const [editedSlug,setEditedSlug]=useState(false);
  const [ownerUserId,setOwnerUserId]=useState('');
  const [city,setCity]=useState('');
  const [address,setAddress]=useState('');
  const [phone,setPhone]=useState('');
  const [email,setEmail]=useState('');
  const [tagline,setTagline]=useState('');
  const [ownerIsBarber,setOwnerIsBarber]=useState(true);
  useEffect(()=>{
    let active=true;
    backendRequest<User[]>('/platform/users')
      .then(data=>{if(active)setUsers(data.filter(u=>u.role==='owner'||u.role==='client'));})
      .catch(e=>{if(active)addToast(e instanceof Error?e.message:'Error cargando propietarios','error');})
      .finally(()=>{if(active)setLoadingUsers(false);});
    return ()=>{active=false;};
  },[]);
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!ownerUserId){addToast('Selecciona un propietario registrado','error');return;}
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)){addToast('La ruta pública debe contener letras, números y guiones','error');return;}
    setBusy(true);
    try{
      await backendRequest('/platform/tenants',{method:'POST',body:JSON.stringify({
        name:name.trim(),slug,ownerUserId,city:city.trim(),address:address.trim(),
        phone:phone.trim(),email:email.trim(),tagline:tagline.trim(),timeZone:'America/Bogota',ownerIsBarber
      })});
      await refreshLiveData();
      addToast('Barbería creada y propietario vinculado correctamente','success');
      onClose();
    }catch(error){addToast(error instanceof Error?error.message:'No se pudo crear la barbería','error');}
    finally{setBusy(false);}
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Crear barbería">
      <form onSubmit={submit} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#141414] border border-[#303030] rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-start gap-4">
          <div><h2 className="text-lg font-bold text-white">Nueva barbería</h2>
            <p className="text-xs text-neutral-400 mt-1">Crea una sede real y asígnale un propietario de Supabase Auth.</p></div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-neutral-400 hover:text-white"><X size={20}/></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-xs text-neutral-300">Nombre del negocio *
            <input className={field} required minLength={2} maxLength={120} value={name} onChange={e=>{const n=e.target.value;setName(n);if(!editedSlug)setSlug(cleanSlug(n));}} placeholder="Ej. BarberNow Centro"/>
          </label>
          <label className="text-xs text-neutral-300">Ruta pública (slug) *
            <input className={field} required maxLength={80} value={slug} onChange={e=>{setEditedSlug(true);setSlug(cleanSlug(e.target.value));}} placeholder="barbernow-centro"/>
          </label>
          <label className="text-xs text-neutral-300 sm:col-span-2">Propietario *
            <select className={field} required value={ownerUserId} onChange={e=>setOwnerUserId(e.target.value)} disabled={loadingUsers}>
              <option value="">{loadingUsers?'Cargando usuarios...':'Selecciona un usuario'}</option>
              {users.map(u=><option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
            </select>
            <span className="block text-neutral-500 mt-1">Si no aparece, créalo primero desde Gestión de Usuarios.</span>
          </label>
          <label className="text-xs text-neutral-300">Ciudad *
            <input className={field} required maxLength={120} value={city} onChange={e=>setCity(e.target.value)} placeholder="Bogotá"/>
          </label>
          <label className="text-xs text-neutral-300">Dirección *
            <input className={field} required maxLength={300} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Calle 10 # 20-30"/>
          </label>
          <label className="text-xs text-neutral-300">Teléfono
            <input className={field} maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+57 300 000 0000"/>
          </label>
          <label className="text-xs text-neutral-300">Correo de contacto
            <input className={field} type="email" maxLength={150} value={email} onChange={e=>setEmail(e.target.value)} placeholder="contacto@barberia.com"/>
          </label>
          <label className="text-xs text-neutral-300 sm:col-span-2">Descripción
            <input className={field} maxLength={250} value={tagline} onChange={e=>setTagline(e.target.value)} placeholder="Cortes modernos, barba y estilo"/>
          </label>
        </div>
        <label className="flex items-start gap-3 text-sm text-neutral-200 bg-[#1d1d1d] border border-[#333] p-3 rounded-xl">
          <input type="checkbox" checked={ownerIsBarber} onChange={e=>setOwnerIsBarber(e.target.checked)} className="mt-1 accent-amber-400"/>
          <span><strong className="block">El propietario también atenderá citas</strong>
            <span className="text-xs text-neutral-400">Crea su perfil de barbero sin quitarle su rol de dueño. Horario inicial: lunes a sábado, de 9:00 a 18:00; podrá ajustarlo después.</span>
          </span>
        </label>
        <div className="flex justify-end gap-3 pt-3 border-t border-[#303030]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-neutral-300" disabled={busy}>Cancelar</button>
          <button type="submit" disabled={busy||loadingUsers||!users.length} className="px-5 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black text-sm font-bold disabled:opacity-50">{busy?'Creando...':'Crear barbería'}</button>
        </div>
      </form>
    </div>
  );
};
