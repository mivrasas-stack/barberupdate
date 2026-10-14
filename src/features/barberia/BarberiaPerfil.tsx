import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BarberInvites } from './BarberInvites';
import {BarberiaWhatsapp} from './BarberiaWhatsapp';
import { ImageUploader } from './ImageUploader';
import {backendRequest,isLiveBackend,refreshLiveData} from '../../services/liveBackend';
import { barberStore } from '../../services/store';
import { Store, MapPin, Phone, Mail, Instagram, Clock, Image, Trash2, Plus, Star, Save } from 'lucide-react';

export const BarberiaPerfil: React.FC = () => {
  const { currentShop, addToast } = useApp();
  const [photoInput, setPhotoInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const shop = currentShop || barberStore.getState().barbershops[0];
  const [formName, setFormName] = useState(shop.name);
  const [formTagline, setFormTagline] = useState(shop.tagline);
  const [formAddress, setFormAddress] = useState(shop.address);
  const [formCity, setFormCity] = useState(shop.city);
  const [formPhone, setFormPhone] = useState(shop.phone);

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
      try{await backendRequest('/tenants/'+shop.id+'/profile',{method:'PATCH',body:JSON.stringify({name:formName,tagline:formTagline,address:formAddress,city:formCity,phone:formPhone})});await refreshLiveData();setIsEditing(false);addToast('Perfil comercial guardado','success');}
      catch(e){addToast(e instanceof Error?e.message:'No se guardó el perfil','error');}
      return;
    }
    e.preventDefault();
    shop.name = formName;
    shop.tagline = formTagline;
    shop.address = formAddress;
    shop.city = formCity;
    shop.phone = formPhone;
    setIsEditing(false);
    addToast('Perfil comercial actualizado exitosamente', 'success');
  };

  return (
    <div className="space-y-6">
      <BarberInvites/>
      {isLiveBackend && <BarberiaWhatsapp tenant={shop.id} addToast={addToast}/>}
      {isLiveBackend && <div className="rounded-2xl bg-[#141414] border border-neutral-700 p-4 space-y-3">
        <h2 className="font-semibold text-sm text-white">Imágenes de identidad comercial</h2>
        <div className="flex flex-wrap gap-5">
          <div><p className="text-xs text-neutral-400 mb-2">Logotipo</p><ImageUploader tenant={shop.id} category="shop" label="Subir logotipo" onUploaded={url=>void uploadBranding('logo',url)}/></div>
          <div><p className="text-xs text-neutral-400 mb-2">Portada</p><ImageUploader tenant={shop.id} category="shop" label="Subir portada" onUploaded={url=>void uploadBranding('cover',url)}/></div>
        </div>
      </div>}
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
              <input
                type="text"
                value={formPhone}
                onChange={e => setFormPhone(e.target.value)}
                className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
          </div>
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
    </div>
  );
};
