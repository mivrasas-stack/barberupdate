import React,{useEffect,useState} from 'react';
import {backendRequest,isLiveBackend} from '../../services/liveBackend';
import { useApp } from '../../context/AppContext';
import { User, Phone, Mail, Award, Calendar, Scissors, ShieldCheck } from 'lucide-react';

type WhatsappConsent={tenant_id:string;phone_e164:string;consented_at:string;revoked_at:string|null};
export const ClientePerfil: React.FC = () => {
  const { currentUser, state,addToast } = useApp();
  const [consents,setConsents]=useState<WhatsappConsent[]>([]);
  useEffect(()=>{
    if(!isLiveBackend||!currentUser)return;
    let active=true;
    backendRequest<WhatsappConsent[]>('/me/whatsapp/consents')
      .then(rows=>{if(active)setConsents(rows)})
      .catch(()=>{});
    return()=>{active=false};
  },[currentUser?.id]);
  const revokeWhatsapp=async(row:WhatsappConsent)=>{
    try{
      await backendRequest('/me/whatsapp/consent',{method:'POST',
        body:JSON.stringify({tenantId:row.tenant_id,phone:row.phone_e164,consent:false})});
      setConsents(current=>current.map(item=>
        item.tenant_id===row.tenant_id&&item.phone_e164===row.phone_e164?{...item,revoked_at:new Date().toISOString()}:item));
      addToast('Autorización de WhatsApp revocada','success');
    }catch(err){addToast(err instanceof Error?err.message:'No fue posible revocar la autorización','error');}
  };
  const customerId = currentUser?.id || 'usr-client-1';
  const loyalty = state.loyalty[customerId] || state.loyalty['usr-client-1'] || { points: 420 };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center pb-4 border-b border-[#242424]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
          Configuración Personal
        </span>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Mi Perfil de Cliente</h1>
      </div>

      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 shadow-xl flex items-center gap-4">
        <img
          src={currentUser?.avatar || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80'}
          alt={currentUser?.name || 'Cliente'}
          className="w-16 h-16 rounded-2xl object-cover border-2 border-[var(--gold-primary)]"
        />
        <div>
          <h2 className="text-lg font-bold text-white">{currentUser?.name || 'Camilo Andrés Torres'}</h2>
          <p className="text-xs text-neutral-400">{currentUser?.email || 'camilo.torres@gmail.com'}</p>
          <div className="mt-1 flex items-center gap-2 text-xs font-mono text-neutral-300">
            <span>{currentUser?.phone || '+57 311 222 3344'}</span>
            <span>·</span>
            <span className="text-[var(--gold-primary)] font-bold">{loyalty.points} pts acumulados</span>
          </div>
        </div>
      </div>

      {isLiveBackend && <section className="bg-[#141414] border border-[#262626] rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">Mis autorizaciones de WhatsApp</h3>
        <p className="text-xs text-neutral-400">Puedes dejar de recibir recordatorios y avisos de citas cuando quieras. Revocar no cancela tus reservas.</p>
        {!consents.length && <p className="text-xs text-neutral-500">No hay autorizaciones de WhatsApp registradas.</p>}
        {consents.map(item=><div key={item.tenant_id+item.phone_e164} className="flex items-center justify-between gap-4 border-t border-neutral-800 py-3 text-xs">
          <span className="text-neutral-300">{item.phone_e164} · {item.revoked_at?'Revocada':'Activa'}</span>
          {!item.revoked_at && <button type="button" onClick={()=>void revokeWhatsapp(item)}
            className="text-rose-300 border border-rose-500/30 rounded-lg px-3 py-2 hover:bg-rose-500/10">Revocar</button>}
        </div>)}
      </section>}
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
