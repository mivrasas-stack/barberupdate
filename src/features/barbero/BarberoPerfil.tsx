import React,{useEffect,useState} from 'react';
import type {Barber} from '../../types';
import {useApp} from '../../context/AppContext';
import {barberStore} from '../../services/store';
import {ImageUploader} from '../barberia/ImageUploader';
import {ProfilePhotoUploader} from '../../components/common/ProfilePhotoUploader';
import {backendRequest,getClientAuthProfile,updateAccountAvatar,updateAccountContact,saveProfessionalProfile,isLiveBackend,refreshLiveData} from '../../services/liveBackend';
import {Scissors,Star,Trash2,UserRound,Save,Camera,Loader2} from 'lucide-react';

const field='w-full bg-[#101010] border border-[#343434] rounded-xl px-3.5 py-3 text-sm text-white outline-none focus:border-[var(--gold-primary)]';
const label='block text-xs font-semibold text-neutral-300 mb-1.5';

export const BarberoPerfil:React.FC<{barberOverride?:Barber}>=({barberOverride})=>{
 const {currentBarber,currentUser,state,addToast,updateCurrentUserProfile}=useApp();
 // The owner passes their own explicitly-linked barber record. Never fall back to another barber.
 const barber=barberOverride||currentBarber||(!isLiveBackend?state.barbers[0]:undefined);
 const [newPhoto,setNewPhoto]=useState('');
 const [publicName,setPublicName]=useState('');
 const [bio,setBio]=useState('');
 const [specialties,setSpecialties]=useState('');
 const [experienceYears,setExperienceYears]=useState(0);
 const [instagram,setInstagram]=useState('');
 const [professionalPhone,setProfessionalPhone]=useState('');
 const [fullName,setFullName]=useState('');
 const [email,setEmail]=useState('');
 const [originalEmail,setOriginalEmail]=useState('');
 const [phone,setPhone]=useState('');
 const [loading,setLoading]=useState(isLiveBackend);
 const [privateLoaded,setPrivateLoaded]=useState(!isLiveBackend);
 const [savingProfessional,setSavingProfessional]=useState(false);
 const [savingPersonal,setSavingPersonal]=useState(false);

 useEffect(()=>{
  if(!barber)return;
  setPublicName(barber.name||'');
  setBio(barber.bio||'');
  setSpecialties((barber.specialties||[]).join(', '));
  setExperienceYears(barber.experienceYears??0);
  setInstagram(barber.instagramUrl||'');
  setProfessionalPhone(barber.phone||'');
 },[barber?.id]);

 useEffect(()=>{
  if(!currentUser)return;
  let alive=true;
  setFullName(currentUser.name||'');
  setPhone(currentUser.phone||'');
  setEmail(currentUser.email||'');
  setOriginalEmail(currentUser.email||'');
  if(!isLiveBackend){setPrivateLoaded(true);setLoading(false);return;}
  setLoading(true);
  getClientAuthProfile().then(p=>{
   if(!alive)return;
   setFullName(p.name||currentUser.name||'');
   setPhone(p.phone||'');
   setEmail(p.email||currentUser.email||'');
   setOriginalEmail(p.email||currentUser.email||'');
   setPrivateLoaded(true);
  }).catch(e=>{if(alive)addToast(e instanceof Error?e.message:'Error al cargar tu cuenta','error');})
   .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[currentUser?.id]);

 const updatePortrait=async(url:string)=>{
  if(!barber?.businessId)throw Error('No se encontró tu barbería vinculada.');
  await backendRequest('/tenants/'+barber.businessId+'/barbers/'+barber.id+'/photo',{
   method:'PATCH',body:JSON.stringify({url})
  });
  await updateAccountAvatar(url);
  await refreshLiveData();
  updateCurrentUserProfile({avatar:url});
  addToast('Tu fotografía de perfil está guardada.','success');
 };

 const savePersonal=async(e:React.FormEvent)=>{
  e.preventDefault();
  if(fullName.trim().length<2||(phone.trim().length>0&&phone.trim().length<7)){addToast('Revisa el nombre y el teléfono','error');return;}
  setSavingPersonal(true);
  try{
   if(isLiveBackend){
    await updateAccountContact({name:fullName,phone,email,originalEmail});
   }
   updateCurrentUserProfile({name:fullName.trim(),phone:phone.trim()});
   addToast(email.toLowerCase()!==originalEmail.toLowerCase()?
    'Datos guardados. Confirma el cambio de correo desde el mensaje enviado por Supabase.':
    'Tus datos personales fueron guardados.','success');
  }catch(err){addToast(err instanceof Error?err.message:'Error al guardar tus datos','error');}
  finally{setSavingPersonal(false);}
 };

 const saveProfessional=async(e:React.FormEvent)=>{
  e.preventDefault();
  if(!barber?.businessId){addToast('Tu barbero no está vinculado a ninguna sede','error');return;}
  const spec=specialties.split(',').map(s=>s.trim()).filter(Boolean);
  if(spec.length>8||spec.some(s=>s.length<2||s.length>65)){
   addToast('Indica hasta ocho especialidades válidas separadas por comas.','error');return;
  }
  setSavingProfessional(true);
  try{
   const data={name:publicName.trim(),bio:bio.trim(),specialties:spec,experienceYears,
    instagramUrl:instagram.trim(),professionalPhone:professionalPhone.trim()};
   if(isLiveBackend){
    await saveProfessionalProfile(barber.businessId,barber.id,data);
    await refreshLiveData();
   }else barberStore.editBarberPersonal(barber.id,{name:data.name,bio:data.bio,
     specialties:spec,experienceYears,instagramUrl:data.instagramUrl,phone:data.professionalPhone});
   addToast('Tu perfil profesional se actualizó correctamente.','success');
  }catch(err){addToast(err instanceof Error?err.message:'No se guardó tu perfil profesional','error');}
  finally{setSavingProfessional(false);}
 };

 const handleAddPhoto=async(photoUrl=newPhoto)=>{
  if(!barber||!photoUrl)return;
  if(isLiveBackend){
   try{
    await backendRequest('/tenants/'+barber.businessId+'/barbers/'+barber.id+'/gallery',{
     method:'PATCH',body:JSON.stringify({photos:[...barber.portfolio,photoUrl]})
    });
    await refreshLiveData();setNewPhoto('');
    addToast('Foto guardada en tu portafolio','success');
   }catch(error){addToast(error instanceof Error?error.message:'Error al guardar fotografía','error');}
  }else{
   const r=barberStore.addPortfolioPhoto('barber',barber.id,photoUrl);
   if(!r.success)addToast(r.error||'Error al agregar fotografía','error');
   else{setNewPhoto('');addToast('Fotografía añadida','success');}
  }
 };

 const handleRemovePhoto=async(index:number)=>{
  if(!barber)return;
  if(isLiveBackend){
   try{
    await backendRequest('/tenants/'+barber.businessId+'/barbers/'+barber.id+'/gallery',{
     method:'PATCH',body:JSON.stringify({photos:barber.portfolio.filter((_,i)=>i!==index)})
    });
    await refreshLiveData();addToast('Fotografía eliminada','success');
   }catch(error){addToast(error instanceof Error?error.message:'Error al eliminar foto','error');}
  }else{barberStore.removePortfolioPhoto('barber',barber.id,index);addToast('Fotografía eliminada','info');}
 };

 if(!barber)return <div className="max-w-4xl mx-auto p-6 bg-[#141414] rounded-2xl text-neutral-400">No se encontró un perfil profesional asociado a tu cuenta. Solicita vinculación al propietario.</div>;

 return (
 <div className="space-y-6 max-w-4xl mx-auto pb-10">
  <div className="border-b border-[#242424] pb-4">
   <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">Marca personal</span>
   <h1 className="text-2xl font-extrabold text-white">Mi Perfil Profesional</h1>
   <p className="mt-1 text-xs text-neutral-400">Configura tus datos personales privados y presenta tu experiencia a los clientes de la barbería.</p>
  </div>

  <section className="rounded-2xl border border-[#262626] bg-[#141414] p-5 sm:p-6 space-y-4">
   <div className="flex flex-wrap gap-5 items-center">
    {barber.photo?<img src={barber.photo} alt="Foto profesional" className="w-24 h-24 rounded-2xl border border-[var(--gold-primary)] object-cover"/>:
    <div className="w-24 h-24 rounded-2xl border border-[var(--gold-primary)] bg-[#202020] flex items-center justify-center">
     <UserRound className="w-10 h-10 text-neutral-400"/>
    </div>}
    <div className="space-y-1 min-w-0">
     <h2 className="text-lg font-bold text-white">{barber.name}</h2>
     <p className="text-xs text-neutral-400">{barber.bio||'Agrega una presentación profesional.'}</p>
     {barber.reviewsCount>0&&<p className="text-xs text-amber-400 flex gap-1 items-center"><Star className="w-4 h-4"/>{barber.rating.toFixed(1)} · {barber.reviewsCount} reseñas</p>}
    </div>
   </div>
   <h3 className="font-bold text-sm text-white flex gap-2 items-center"><Camera className="w-4 h-4 text-[var(--gold-primary)]"/>Mi foto profesional</h3>
   <p className="text-xs text-neutral-400">Sube tu fotografía. Se mostrará en tu perfil, en la agenda y en la tarjeta del barbero.</p>
   {isLiveBackend?<ProfilePhotoUploader tenantId={barber.businessId} label="Subir o cambiar mi foto" onSaved={updatePortrait}/>:
    <p className="text-xs text-amber-300">Subir fotos requiere iniciar sesión en el modo conectado.</p>}
  </section>

  <form onSubmit={e=>void savePersonal(e)} className="rounded-2xl border border-[#262626] bg-[#141414] p-5 sm:p-6 space-y-4">
   <h3 className="text-sm font-bold text-white flex items-center gap-2"><UserRound className="w-4 h-4 text-[var(--gold-primary)]"/>Mis datos personales</h3>
   <p className="text-xs text-neutral-400">Estos datos pertenecen a tu cuenta. No son visibles en el catálogo público de barberos.</p>
   {loading&&<p role="status" className="text-xs text-neutral-400 flex gap-1"><Loader2 className="w-4 h-4 animate-spin"/>Cargando...</p>}
   <div><label className={label} htmlFor="barber-full-name">Nombre y apellidos</label>
    <input id="barber-full-name" className={field} required minLength={2} maxLength={120} autoComplete="name" value={fullName} onChange={e=>setFullName(e.target.value)}/></div>
   <div className="grid sm:grid-cols-2 gap-4">
    <div><label className={label} htmlFor="barber-email">Correo electrónico</label>
     <input id="barber-email" className={field} type="email" required autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/>
     <p className="mt-1 text-[11px] text-neutral-500">El nuevo correo puede requerir confirmación.</p>
    </div>
    <div><label className={label} htmlFor="barber-phone">Teléfono personal</label>
     <input id="barber-phone" className={field} type="tel" minLength={7} maxLength={32} autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)}/>
    </div>
   </div>
   <button type="submit" disabled={savingPersonal||loading||!privateLoaded} className="flex items-center justify-center gap-2 rounded-xl bg-[var(--gold-primary)] px-5 py-2.5 text-xs font-bold text-black disabled:opacity-40">
    <Save className="w-4 h-4"/>{savingPersonal?'Guardando...':'Guardar datos personales'}
   </button>
  </form>

  <form onSubmit={e=>void saveProfessional(e)} className="rounded-2xl border border-[#262626] bg-[#141414] p-5 sm:p-6 space-y-4">
   <h3 className="text-sm font-bold text-white flex items-center gap-2"><Scissors className="w-4 h-4 text-[var(--gold-primary)]"/>Mi información profesional</h3>
   <p className="text-xs text-neutral-400">Estos datos sí pueden mostrarse a clientes al seleccionar al barbero.</p>
   <div><label className={label} htmlFor="barber-public-name">Nombre profesional visible</label>
    <input id="barber-public-name" required minLength={2} maxLength={120} className={field} value={publicName} onChange={e=>setPublicName(e.target.value)}/></div>
   <div><label className={label} htmlFor="barber-bio">Sobre mí y mi experiencia</label>
    <textarea id="barber-bio" rows={4} maxLength={2000} className={field} value={bio} onChange={e=>setBio(e.target.value)}
      placeholder="Cuenta a los clientes tu trayectoria y qué hace especial tu trabajo."/>
   </div>
   <div className="grid sm:grid-cols-2 gap-4">
    <div><label className={label} htmlFor="barber-specialties">Especialidades, separadas por comas</label>
     <input id="barber-specialties" className={field} value={specialties} onChange={e=>setSpecialties(e.target.value)}
      placeholder="Degradados, barba, cortes clásicos"/>
     <p className="text-[11px] text-neutral-500 mt-1">Máximo ocho especialidades.</p>
    </div>
    <div><label className={label} htmlFor="barber-experience">Años de experiencia</label>
     <input id="barber-experience" type="number" min={0} max={70} step={1} className={field}
      value={experienceYears} onChange={e=>setExperienceYears(Number(e.target.value))}/>
    </div>
    <div><label className={label} htmlFor="barber-instagram">Instagram profesional (URL completa)</label>
     <input id="barber-instagram" type="url" maxLength={160} className={field} value={instagram} onChange={e=>setInstagram(e.target.value)}
      placeholder="https://www.instagram.com/tu_usuario/"/>
    </div>
    <div><label className={label} htmlFor="barber-public-phone">Teléfono de contacto profesional (opcional)</label>
     <input id="barber-public-phone" type="tel" maxLength={40} className={field}
      value={professionalPhone} onChange={e=>setProfessionalPhone(e.target.value)} placeholder="+57 300 123 4567"/>
    </div>
   </div>
   <button type="submit" disabled={savingProfessional} className="flex items-center justify-center gap-2 rounded-xl bg-[var(--gold-primary)] px-5 py-2.5 text-xs font-bold text-black disabled:opacity-40">
    <Save className="w-4 h-4"/>{savingProfessional?'Guardando...':'Guardar perfil profesional'}
   </button>
   <p className="text-[11px] text-neutral-500">La modalidad contractual, los pagos y la agenda se siguen gestionando en sus módulos correspondientes.</p>
  </form>

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
          <div className="space-y-2 text-xs">
            {isLiveBackend && <ImageUploader tenant={barber.businessId || ''} category="barber" onUploaded={url=>void handleAddPhoto(url)} />}
            {!isLiveBackend && <div className="flex gap-2">
            <input
              type="url"
              value={newPhoto}
              onChange={e => setNewPhoto(e.target.value)}
              placeholder="Ingresa la URL de tu imagen de trabajo..."
              className="flex-1 bg-[#181818] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white"
            />
            <button
              onClick={()=>void handleAddPhoto()}
              className="px-4 py-2 rounded-xl bg-[var(--gold-primary)] text-black font-bold hover:bg-[var(--gold-hover)]"
            >
              Añadir Foto
            </button>
            </div>}
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
              <img src={img || '/images/placeholder.svg'} onError={e=>{if(!e.currentTarget.src.endsWith('/images/placeholder.svg'))e.currentTarget.src='/images/placeholder.svg';}} alt={`Trabajo ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              <button
                type="button" onClick={() => void handleRemovePhoto(i)}
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
