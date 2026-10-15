import React,{useEffect,useState} from 'react';
import {backendRequest,getClientAuthProfile,isLiveBackend,saveClientAuthProfile,updateAccountAvatar,type ClientCutPreferences} from '../../services/liveBackend';
import {useApp} from '../../context/AppContext';
import {ProfilePhotoUploader} from '../../components/common/ProfilePhotoUploader';
import {User,Phone,Mail,Award,Scissors,Save,ShieldCheck,Loader2} from 'lucide-react';

type WhatsappConsent={tenant_id:string;phone_e164:string;consented_at:string;revoked_at:string|null};
const emptyPreferences:ClientCutPreferences={style:'',topLength:'',beard:'',notes:''};
const fieldClass='w-full rounded-xl border border-[#363636] bg-[#101010] px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-[var(--gold-primary)]';
const labelClass='block text-xs font-semibold text-neutral-300 mb-2';

export const ClientePerfil:React.FC=()=>{
 const {currentUser,state,addToast,updateCurrentUserProfile}=useApp();
 const [consents,setConsents]=useState<WhatsappConsent[]>([]);
 const [name,setName]=useState(currentUser?.name||'');
 const [email,setEmail]=useState(currentUser?.email||'');
 const [originalEmail,setOriginalEmail]=useState(currentUser?.email||'');
 const [phone,setPhone]=useState(currentUser?.phone||'');
 const [preferences,setPreferences]=useState<ClientCutPreferences>(emptyPreferences);
 const [loading,setLoading]=useState(isLiveBackend);
 const [busy,setBusy]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const customerId=currentUser?.id||'';
 const points=state.loyalty[customerId]?.points??0;

 useEffect(()=>{
  if(!currentUser)return;
  let active=true;
  setName(currentUser.name||'');setEmail(currentUser.email||'');
  setOriginalEmail(currentUser.email||'');setPhone(currentUser.phone||'');
  if(!isLiveBackend){setLoading(false);setLoaded(true);return}
  setLoading(true);
  Promise.all([
    getClientAuthProfile(),
    backendRequest<WhatsappConsent[]>('/me/whatsapp/consents').catch(()=>[])
  ]).then(([profile,rows])=>{
    if(!active)return;
    setConsents(rows);setName(profile.name||currentUser.name||'');
    setEmail(profile.email||currentUser.email||'');
    setOriginalEmail(profile.email||currentUser.email||'');
    setPhone(profile.phone||currentUser.phone||'');
    setPreferences(profile.preferences);
    setLoaded(true);
  }).catch(err=>{
    if(active)addToast(err instanceof Error?err.message:'No se pudo cargar el perfil','error');
  }).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[currentUser?.id]);

 const patchPreference=(key:keyof ClientCutPreferences,value:string)=>{
  setPreferences(current=>({...current,[key]:value}));
 };
 const onPhotoUploaded=async(url:string)=>{
   await updateAccountAvatar(url);
   updateCurrentUserProfile({avatar:url});
   addToast('Foto de perfil guardada en tu cuenta.','success');
 };
 const save=async(e:React.FormEvent)=>{
  e.preventDefault();
  const fullName=name.trim(),contact=phone.trim(),mail=email.trim().toLowerCase();
  if(fullName.length<2||fullName.length>120||contact.length<7||contact.length>32){
    addToast('Revisa el nombre completo y el número de contacto.','error');return;
  }
  setBusy(true);
  try{
   if(isLiveBackend){
    await saveClientAuthProfile({name:fullName,email:mail,phone:contact,avatar:currentUser?.avatar||'',preferences},originalEmail);
   }
   updateCurrentUserProfile({name:fullName,email:originalEmail!==mail?originalEmail:mail,phone:contact});
   if(originalEmail!==mail){
    addToast('Datos guardados. Confirma el nuevo correo desde el enlace que te envíe Supabase antes de iniciar sesión con él.','info');
   }else addToast(isLiveBackend?'Perfil y preferencias guardados en Supabase.':'Preferencias actualizadas en esta sesión de demostración.','success');
  }catch(err){addToast(err instanceof Error?err.message:'No fue posible guardar el perfil','error');}
  finally{setBusy(false);}
 };
 const revokeWhatsapp=async(row:WhatsappConsent)=>{
  try{
   await backendRequest('/me/whatsapp/consent',{method:'POST',body:JSON.stringify({tenantId:row.tenant_id,phone:row.phone_e164,consent:false})});
   setConsents(current=>current.map(item=>item.tenant_id===row.tenant_id&&item.phone_e164===row.phone_e164?
    {...item,revoked_at:new Date().toISOString()}:item));
   addToast('Autorización de WhatsApp revocada','success');
  }catch(err){addToast(err instanceof Error?err.message:'No fue posible revocar la autorización','error');}
 };
 return (
 <div className="max-w-3xl mx-auto space-y-6 pb-8">
  <div className="text-center pb-5 border-b border-[#242424]">
   <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">Configuración Personal</span>
   <h1 className="text-2xl font-extrabold text-white">Mi Perfil de Cliente</h1>
   <p className="mt-2 text-xs text-neutral-400">Actualiza tus datos y describe cómo prefieres tu corte. No se muestran preferencias inventadas.</p>
  </div>
  <section className="bg-[#141414] border border-[#262626] rounded-2xl p-5 sm:p-6 flex items-center gap-4">
   {currentUser?.avatar?
    <img src={currentUser.avatar} alt="Foto de perfil" className="w-16 h-16 rounded-2xl object-cover border border-[var(--gold-primary)]"/>:
    <div className="w-16 h-16 rounded-2xl border border-[var(--gold-primary)] flex items-center justify-center bg-[#202020]">
      <User className="w-7 h-7 text-[var(--gold-primary)]"/>
    </div>}
   <div className="min-w-0">
    <h2 className="font-bold text-white truncate">{currentUser?.name||'Cliente'}</h2>
    <p className="text-xs text-neutral-400 truncate">{currentUser?.email}</p>
    <span className="text-xs text-[var(--gold-primary)] font-mono font-semibold">{points} puntos acumulados</span>
   </div>
  </section>
  <section className="rounded-2xl border border-[#262626] bg-[#141414] p-5 sm:p-6 space-y-3">
   <h2 className="text-sm font-bold text-white">Mi fotografía de perfil</h2>
   <p className="text-xs text-neutral-400">Sube una imagen real desde tu dispositivo. Se mostrará en Mi Panel, el menú y tu cuenta.</p>
   {isLiveBackend?<ProfilePhotoUploader label="Subir o cambiar mi foto" onSaved={onPhotoUploaded}/>:
    <p className="text-xs text-amber-300">La carga persistente requiere iniciar sesión en el sistema conectado.</p>}
  </section>
  <form onSubmit={e=>void save(e)} className="space-y-5">
   <section className="rounded-2xl border border-[#262626] bg-[#141414] p-5 sm:p-6 space-y-4">
    <h2 className="flex items-center gap-2 text-sm font-bold text-white"><User className="w-4 h-4 text-[var(--gold-primary)]"/>Datos personales</h2>
    {loading&&<p role="status" className="text-xs text-neutral-400 flex gap-2"><Loader2 className="w-4 h-4 animate-spin"/>Cargando datos guardados...</p>}
    <div>
     <label htmlFor="cp-name" className={labelClass}>Nombre y apellidos</label>
     <input id="cp-name" className={fieldClass} required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre completo"/>
    </div>
    <div className="grid sm:grid-cols-2 gap-4">
     <div><label htmlFor="cp-email" className={labelClass}>Correo electrónico</label>
      <input id="cp-email" className={fieldClass} type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/>
      <p className="text-[11px] text-neutral-500 mt-1">Cambiar el correo puede requerir confirmación.</p>
     </div>
     <div><label htmlFor="cp-phone" className={labelClass}>Teléfono de contacto</label>
      <input id="cp-phone" className={fieldClass} type="tel" required minLength={7} maxLength={32} autoComplete="tel" placeholder="+57 300 123 4567" value={phone} onChange={e=>setPhone(e.target.value)}/>
     </div>
    </div>
   </section>
   <section className="rounded-2xl border border-[#262626] bg-[#141414] p-5 sm:p-6 space-y-4">
    <h2 className="flex items-center gap-2 text-sm font-bold text-white"><Scissors className="w-4 h-4 text-[var(--gold-primary)]"/>Mis preferencias de corte</h2>
    <p className="text-xs text-neutral-400">Este apartado empieza vacío. Tú decides qué información guardar para próximas reservas.</p>
    <div className="grid sm:grid-cols-2 gap-4">
     <div><label htmlFor="cp-style" className={labelClass}>Estilo habitual</label><input id="cp-style" className={fieldClass} maxLength={160} placeholder="Ej. Degradado medio" value={preferences.style} onChange={e=>patchPreference('style',e.target.value)}/></div>
     <div><label htmlFor="cp-top" className={labelClass}>Longitud y peinado superior</label><input id="cp-top" className={fieldClass} maxLength={160} placeholder="Ej. Tijera, largo medio" value={preferences.topLength} onChange={e=>patchPreference('topLength',e.target.value)}/></div>
     <div className="sm:col-span-2"><label htmlFor="cp-beard" className={labelClass}>Preferencia de barba</label><input id="cp-beard" className={fieldClass} maxLength={160} placeholder="Ej. Perfilado de barba o sin barba" value={preferences.beard} onChange={e=>patchPreference('beard',e.target.value)}/></div>
     <div className="sm:col-span-2"><label htmlFor="cp-notes" className={labelClass}>Otras indicaciones (opcionales)</label>
      <textarea id="cp-notes" className={fieldClass} rows={3} maxLength={700} value={preferences.notes} onChange={e=>patchPreference('notes',e.target.value)} placeholder="Alergias a productos, cuidados o detalles que quieras recordar."/>
     </div>
    </div>
   </section>
   <button type="submit" disabled={busy||loading||!loaded}
    className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[var(--gold-primary)] text-black font-bold text-sm disabled:opacity-50">
    {busy?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}{busy?'Guardando...':'Guardar mi perfil'}
   </button>
  </form>
  {isLiveBackend&&<section className="rounded-2xl border border-[#262626] bg-[#141414] p-5 sm:p-6 space-y-3">
   <h2 className="flex items-center gap-2 text-sm font-bold text-white"><ShieldCheck className="w-4 h-4 text-[var(--gold-primary)]"/>Mis autorizaciones de WhatsApp</h2>
   <p className="text-xs text-neutral-400">Puedes revocar los recordatorios sin cancelar tus citas.</p>
   {!consents.length&&<p className="text-xs text-neutral-500">No hay autorizaciones registradas.</p>}
   {consents.map(item=><div key={item.tenant_id+item.phone_e164} className="flex items-center justify-between gap-4 border-t border-neutral-800 py-3 text-xs">
    <span className="text-neutral-300">{item.phone_e164} · {item.revoked_at?'Revocada':'Activa'}</span>
    {!item.revoked_at&&<button type="button" onClick={()=>void revokeWhatsapp(item)}
     className="text-rose-300 border border-rose-500/30 rounded-lg px-3 py-2 hover:bg-rose-500/10">Revocar</button>}
   </div>)}
  </section>}
 </div>
 );
};