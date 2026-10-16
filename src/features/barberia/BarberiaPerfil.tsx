import React, { useState } from 'react';
import {BarberoPerfil} from '../barbero/BarberoPerfil';
import { useApp } from '../../context/AppContext';
import { BarberInvites } from './BarberInvites';
import {BarberiaWhatsapp} from './BarberiaWhatsapp';
import { ImageUploader } from './ImageUploader';
import {backendRequest,isLiveBackend,refreshLiveData} from '../../services/liveBackend';
import { barberStore } from '../../services/store';
import { Store, MapPin, Phone, Mail, Instagram, Clock, Image, Trash2, Plus, Star, Save, Scissors, UserRound } from 'lucide-react';

export const BarberiaPerfil: React.FC = () => {
  const { currentShop, currentUser, state, addToast } = useApp();
  const [activeTab,setActiveTab] = useState<'commercial'|'professional'>('commercial');
  const [creatingProfessional,setCreatingProfessional] = useState(false);
  const [photoInput, setPhotoInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const shop = currentShop || barberStore.getState().barbershops[0];
  // Managers and other barber staff must not gain access to the owner's private profile.
  const isActualOwner = Boolean(isLiveBackend && currentUser && shop.ownerId === currentUser.id && currentUser.role === 'owner');
  const ownerBarber = isActualOwner ? state.barbers.find(b=>b.businessId===shop.id && b.userId===currentUser?.id) : undefined;
  const enableProfessionalProfile = async()=>{
    if(!isActualOwner || !currentUser || creatingProfessional)return;
    setCreatingProfessional(true);
    try{
      await backendRequest('/tenants/'+shop.id+'/barbers/me',{method:'POST',
        body:JSON.stringify({name:currentUser.name.trim() || currentUser.email.split('@')[0]})});
      await refreshLiveData();
      addToast('Tu perfil profesional está listo para personalizar y recibir reservas.','success');
    }catch(error){
      addToast(error instanceof Error?error.message:'No fue posible activar tu perfil de barbero.','error');
    }finally{setCreatingProfessional(false);}
  };
  const [formName, setFormName] = useState(shop.name);
  const [formTagline, setFormTagline] = useState(shop.tagline);
  const [formAddress, setFormAddress] = useState(shop.address);
  const [formCity, setFormCity] = useState(shop.city);
  const [formPhone, setFormPhone] = useState(shop.phone);
  const [formEmail,setFormEmail]=useState(shop.email||'');
  const [formInstagram,setFormInstagram]=useState(shop.socialLinks?.instagram||'');
  const [formWhatsapp,setFormWhatsapp]=useState(shop.socialLinks?.whatsapp||'');
  const [formDays,setFormDays]=useState(shop.openingHours?.days||'Lunes a sábado');
  const [formOpen,setFormOpen]=useState(shop.openingHours?.open||'09:00');
  const [formClose,setFormClose]=useState(shop.openingHours?.close||'20:00');
  const [formLat,setFormLat]=useState<number|null>(shop.coordinates?.lat??null);
  const [formLng,setFormLng]=useState<number|null>(shop.coordinates?.lng??null);
  const [gpsBusy,setGpsBusy]=useState(false);
  const useGps=()=>{
    if(!navigator.geolocation){addToast('GPS no disponible en este navegador','error');return;}
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      pos=>{setFormLat(Number(pos.coords.latitude.toFixed(6)));setFormLng(Number(pos.coords.longitude.toFixed(6)));setGpsBusy(false);},
      ()=>{setGpsBusy(false);addToast('No fue posible obtener la ubicación; puedes introducirla manualmente','error');},
      {enableHighAccuracy:true,timeout:15000,maximumAge:0}
    );
  };

  const uploadBranding = async (kind:'logo'|'cover',url:string) => {
    try{
      await backendRequest('/tenants/'+shop.id+'/branding',{method:'PATCH',body:JSON.stringify({kind,url})});
      await refreshLiveData();
      addToast('Imagen comercial actualizada','success');
    }catch(e){addToast(e instanceof Error?e.message:'No se pudo guardar la imagen','error');}
  };
  const handleAddPhoto = async (photoUrl=photoInput) => {
    if(isLiveBackend){
      if(!photoUrl)return;
      try{await backendRequest('/tenants/'+shop.id+'/gallery',{method:'PATCH',body:JSON.stringify({photos:[...shop.portfolio,photoUrl]})});await refreshLiveData();setPhotoInput('');addToast('Fotografía guardada','success');}
      catch(e){addToast(e instanceof Error?e.message:'Error al guardar fotografía','error');}
      return;
    }
    if (!photoInput) return;
    const res = barberStore.addPortfolioPhoto('barbershop', shop.id, photoInput);
    if (!res.success) {
      addToast(res.error || 'Error al subir foto', 'error');
      return;
    }
    addToast('Fotografía añadida a la galería de la barbería', 'success');
    setPhotoInput('');
  };

  const handleRemovePhoto = async (index: number) => {
    if(isLiveBackend){
      try{await backendRequest('/tenants/'+shop.id+'/gallery',{method:'PATCH',body:JSON.stringify({photos:shop.portfolio.filter((_,i)=>i!==index)})});await refreshLiveData();addToast('Fotografía eliminada','success');}
      catch(e){addToast(e instanceof Error?e.message:'Error al eliminar fotografía','error');}
      return;
    }
    barberStore.removePortfolioPhoto('barbershop', shop.id, index);
    addToast('Fotografía removida', 'info');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    if(isLiveBackend){
      e.preventDefault();
      try{await backendRequest('/tenants/'+shop.id+'/profile',{method:'PATCH',body:JSON.stringify({name:formName,tagline:formTagline,address:formAddress,city:formCity,phone:formPhone,email:formEmail,latitude:formLat,longitude:formLng,openingHours:{days:formDays,open:formOpen,close:formClose},socialLinks:{instagram:formInstagram,whatsapp:formWhatsapp}})});await refreshLiveData();setIsEditing(false);addToast('Perfil comercial guardado','success');}
      catch(e){addToast(e instanceof Error?e.message:'No se guardó el perfil','error');}
      return;
    }
    e.preventDefault();
    shop.name = formName;
    shop.tagline = formTagline;
    shop.address = formAddress;
    shop.city = formCity;
    shop.phone = formPhone;
    shop.email = formEmail;
    shop.socialLinks = {instagram:formInstagram,whatsapp:formWhatsapp};
    shop.openingHours={days:formDays,open:formOpen,close:formClose};
    if(formLat!==null&&formLng!==null)shop.coordinates={lat:formLat,lng:formLng};
    setIsEditing(false);
    addToast('Perfil comercial actualizado exitosamente', 'success');
  };

  return (
    <div className="space-y-6">
      {isActualOwner && (
        <div className="flex flex-wrap gap-2 border-b border-[#292929] pb-3" role="tablist" aria-label="Perfiles de la barbería">
          <button type="button" role="tab" aria-selected={activeTab==='commercial'}
            onClick={()=>setActiveTab('commercial')}
            className={'flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors '+(activeTab==='commercial'?'bg-[var(--gold-primary)] text-black':'bg-[#1b1b1b] text-neutral-300 hover:text-white border border-[#303030]')}>
            <Store className="h-4 w-4"/> Perfil comercial
          </button>
          <button type="button" role="tab" aria-selected={activeTab==='professional'}
            onClick={()=>setActiveTab('professional')}
            className={'flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors '+(activeTab==='professional'?'bg-[var(--gold-primary)] text-black':'bg-[#1b1b1b] text-neutral-300 hover:text-white border border-[#303030]')}>
            <Scissors className="h-4 w-4"/> Mi perfil de barbero
          </button>
        </div>
      )}
      {isActualOwner && activeTab==='professional' && (
        <div role="tabpanel" aria-label="Mi perfil de barbero">
          {ownerBarber ? (
            <BarberoPerfil barberOverride={ownerBarber}/>
          ) : (
            <div className="max-w-4xl mx-auto rounded-2xl border border-[#343434] bg-[#141414] p-6 space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <UserRound className="h-5 w-5 text-[var(--gold-primary)]"/> Atiende citas como dueño y barbero
              </h2>
              <p className="text-sm text-neutral-400">Activa tu propio perfil profesional para mostrar tu foto, biografía, especialidades y portafolio. Aparecerás como opción al agendar, sin perder el acceso de propietario.</p>
              <p className="text-xs text-neutral-500">Horario inicial: lunes a sábado de 9:00 a 18:00. Podrás ajustarlo desde la gestión de horarios.</p>
              <button type="button" disabled={creatingProfessional} onClick={()=>void enableProfessionalProfile()}
                className="rounded-xl bg-[var(--gold-primary)] px-5 py-3 text-sm font-bold text-black disabled:opacity-50">
                {creatingProfessional?'Activando...':'Activar mi perfil de barbero'}
              </button>
            </div>
          )}
        </div>
      )}
      {activeTab==='commercial' && <>
      <BarberInvites/>
      {isLiveBackend && <BarberiaWhatsapp tenant={shop.id} addToast={addToast}/>}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Identidad de Marca
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Perfil Comercial & Portafolio</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Información visible para los clientes y galería de hasta 10 fotos oficiales
          </p>
        </div>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-4 py-2 rounded-xl bg-[#202020] border border-neutral-700 text-xs font-semibold text-white hover:bg-[#2a2a2a] transition-colors"
        >
          {isEditing ? 'Cancelar Edición' : 'Editar Información'}
        </button>
      </div>

      {/* Cover & Brand Lockup */}
      <div className="relative rounded-2xl overflow-hidden border border-[#262626] bg-[#141414]">
        <div className="h-44 w-full bg-neutral-900 relative">
          <img src={shop.coverImage || '/images/placeholder.svg'} onError={e=>{if(!e.currentTarget.src.endsWith('/images/placeholder.svg'))e.currentTarget.src='/images/placeholder.svg';}} alt={shop.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/30 to-transparent" />
        </div>

        <div className="p-6 pt-0 relative -mt-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            <img
              src={shop.logo || '/images/placeholder.svg'} onError={e=>{if(!e.currentTarget.src.endsWith('/images/placeholder.svg'))e.currentTarget.src='/images/placeholder.svg';}}
              alt={shop.name}
              className="w-20 h-20 rounded-2xl object-cover border-4 border-[#141414] shadow-2xl"
            />
            <div>
              <h2 className="text-xl font-bold text-white">{shop.name}</h2>
              <p className="text-xs text-neutral-400">{shop.tagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 border border-neutral-800 text-amber-400 text-xs font-bold font-mono">
            <Star className="w-4 h-4 fill-amber-400" />
            <span>{shop.rating} / 5.0</span>
            <span className="text-neutral-500 font-normal">({shop.reviewsCount} reseñas)</span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="p-6 pt-2 border-t border-neutral-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-neutral-300">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[var(--gold-primary)] shrink-0" />
            <span>{shop.address}, {shop.city}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-[var(--gold-primary)] shrink-0" />
            <span>{shop.phone}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--gold-primary)] shrink-0" />
            <span>{shop.openingHours.days} ({shop.openingHours.open} - {shop.openingHours.close})</span>
          </div>
        </div>
      </div>

      {isEditing && (
        <form onSubmit={handleSaveProfile} className="p-5 rounded-2xl bg-[#141414] border border-[var(--gold-primary)]/40 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-white">Editar Datos Comerciales</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-400 block mb-1">Nombre Comercial</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1">Lema o Tagline</label>
              <input
                type="text"
                value={formTagline}
                onChange={e => setFormTagline(e.target.value)}
                className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1">Dirección</label>
              <input
                type="text"
                value={formAddress}
                onChange={e => setFormAddress(e.target.value)}
                className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1">Teléfono</label>
              <input type="tel" value={formPhone} maxLength={40}
                onChange={e=>setFormPhone(e.target.value)} className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"/>
            </div>
            <div>
              <label className="text-neutral-400 block mb-1">Correo electrónico de contacto</label>
              <input type="email" value={formEmail} maxLength={254}
                onChange={e=>setFormEmail(e.target.value)} placeholder="contacto@barberia.com"
                className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"/>
            </div>
            <div>
              <label className="text-neutral-400 block mb-1">Ciudad o municipio</label>
              <input type="text" value={formCity} maxLength={120}
                onChange={e=>setFormCity(e.target.value)} placeholder="Ej. Chía, Cundinamarca"
                className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white"/>
            </div>
          </div>
          <div className="border-t border-neutral-800 pt-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <h4 className="font-semibold text-amber-400">Ubicación y georreferenciación</h4>
              <button type="button" disabled={gpsBusy} onClick={useGps}
                className="rounded-xl px-3 py-2 bg-amber-400 text-black font-semibold disabled:opacity-50">
                {gpsBusy?'Obteniendo GPS...':'Tomar mi ubicación actual (GPS)'}
              </button>
            </div>
            <p className="text-[11px] text-neutral-500">La ubicación se solicita solo cuando pulsas el botón; revisa las coordenadas antes de guardarlas.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label>Latitud<input type="number" step="any" min={-90} max={90} value={formLat??''}
                placeholder="0" onChange={e=>setFormLat(e.target.value===''?null:Number(e.target.value))}
                className="mt-1 w-full bg-[#181818] border border-neutral-700 rounded-lg px-3 py-2"/></label>
              <label>Longitud<input type="number" step="any" min={-180} max={180} value={formLng??''}
                placeholder="0" onChange={e=>setFormLng(e.target.value===''?null:Number(e.target.value))}
                className="mt-1 w-full bg-[#181818] border border-neutral-700 rounded-lg px-3 py-2"/></label>
            </div>
          </div>
          <div className="border-t border-neutral-800 pt-4 space-y-3">
            <h4 className="font-semibold text-amber-400">Horario y redes sociales</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label>Días de atención<input type="text" maxLength={80} value={formDays}
                onChange={e=>setFormDays(e.target.value)} className="mt-1 w-full bg-[#181818] border border-neutral-700 rounded-lg px-3 py-2"/></label>
              <label>Hora de apertura<input type="time" value={formOpen}
                onChange={e=>setFormOpen(e.target.value)} className="mt-1 w-full bg-[#181818] border border-neutral-700 rounded-lg px-3 py-2"/></label>
              <label>Hora de cierre<input type="time" value={formClose}
                onChange={e=>setFormClose(e.target.value)} className="mt-1 w-full bg-[#181818] border border-neutral-700 rounded-lg px-3 py-2"/></label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label>Instagram<input type="text" maxLength={120} value={formInstagram}
                onChange={e=>setFormInstagram(e.target.value)} placeholder="@barberia"
                className="mt-1 w-full bg-[#181818] border border-neutral-700 rounded-lg px-3 py-2"/></label>
              <label>WhatsApp comercial<input type="tel" maxLength={40} value={formWhatsapp}
                onChange={e=>setFormWhatsapp(e.target.value)} placeholder="Ej. 573001234567"
                className="mt-1 w-full bg-[#181818] border border-neutral-700 rounded-lg px-3 py-2"/></label>
            </div>
          </div>
          {isLiveBackend&&<div className="border-t border-neutral-800 pt-4 space-y-3">
            <h4 className="font-semibold text-amber-400">Logotipo y portada</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2"><p>Logotipo actual</p>
                {shop.logo&&<img src={shop.logo} alt="Logotipo actual" className="h-24 w-full object-contain rounded-lg"/>}
                <ImageUploader tenant={shop.id} category="shop" label="Subir logotipo" onUploaded={url=>void uploadBranding('logo',url)}/>
              </div>
              <div className="space-y-2"><p>Portada actual</p>
                {shop.coverImage&&<img src={shop.coverImage} alt="Portada actual" className="h-24 w-full object-cover rounded-lg"/>}
                <ImageUploader tenant={shop.id} category="shop" label="Subir portada" onUploaded={url=>void uploadBranding('cover',url)}/>
              </div>
            </div>
          </div>}
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[var(--gold-primary)] text-black font-bold flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar Perfil</span>
          </button>
        </form>
      )}

      {/* Portfolio Gallery Section (Strict 10 Photos Limit) */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-800">
          <div>
            <h3 className="text-sm font-bold text-white">Galería Fotográfica Oficial</h3>
            <p className="text-xs text-neutral-400">Muestra los mejores cortes y el espacio de tu barbería</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#1a1a1a] text-[var(--gold-primary)] border border-neutral-800">
            {shop.portfolio.length} de 10 fotografías
          </span>
        </div>

        {shop.portfolio.length < 10 ? (
          <div className="space-y-2 text-xs">
            {isLiveBackend && <ImageUploader tenant={shop.id} category="shop" onUploaded={u=>void handleAddPhoto(u)}/>}
            {!isLiveBackend && <div className="flex gap-2">
            <input
              type="url"
              value={photoInput}
              onChange={e => setPhotoInput(e.target.value)}
              placeholder="Pega la URL de una nueva foto (ej. https://images.unsplash.com/...)"
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
            Has completado las 10 fotografías permitidas en el perfil oficial. Elimina una para añadir otra.
          </div>
        )}

        {/* Gallery */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {shop.portfolio.map((img, i) => (
            <div key={i} className="relative group rounded-xl overflow-hidden border border-neutral-800 aspect-square bg-neutral-900">
              <img src={img} onError={e=>{if(!e.currentTarget.src.endsWith('/images/placeholder.svg'))e.currentTarget.src='/images/placeholder.svg';}} alt={`Foto ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              <button
                onClick={() => void handleRemovePhoto(i)}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                title="Eliminar foto"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <span className="absolute bottom-2 left-2 text-[10px] font-mono bg-black/70 px-1.5 py-0.5 rounded text-white">
                #{i + 1}
              </span>
            </div>
          ))}
        </div>
      </div>
      </>}
    </div>
  );
};
