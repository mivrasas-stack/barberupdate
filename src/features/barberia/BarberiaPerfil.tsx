import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BarberInvites } from './BarberInvites';
import { barberStore } from '../../services/store';
import { ImageUpload } from '../../components/common/ImageUpload';
import { isLiveBackend, updateShopProfile, refreshLiveData } from '../../services/liveBackend';
import {
  Store,
  MapPin,
  Phone,
  Mail,
  Instagram,
  Clock,
  Image as ImageIcon,
  Trash2,
  Plus,
  Star,
  Save,
  Navigation,
  Crosshair,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  X,
  Edit3,
  Loader2,
  Sparkles,
  Eye,
  Camera,
  Globe,
  Check,
} from 'lucide-react';

export const BarberiaPerfil: React.FC = () => {
  const { currentShop, addToast } = useApp();
  const shop = currentShop || barberStore.getState().barbershops[0];

  const [isEditing, setIsEditing] = useState(false);
  const [photoInput, setPhotoInput] = useState('');
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState(false);

  // Form states
  const [formName, setFormName] = useState(shop.name || '');
  const [formTagline, setFormTagline] = useState(shop.tagline || '');
  const [formAddress, setFormAddress] = useState(shop.address || '');
  const [formCity, setFormCity] = useState(shop.city || '');
  const [formPhone, setFormPhone] = useState(shop.phone || '');
  const [formEmail, setFormEmail] = useState(shop.email || '');
  const [formLogo, setFormLogo] = useState(shop.logo || '');
  const [formCover, setFormCover] = useState(shop.coverImage || '');
  const [formDays, setFormDays] = useState(shop.openingHours?.days || 'Lunes a Sábado');
  const [formOpen, setFormOpen] = useState(shop.openingHours?.open || '09:00');
  const [formClose, setFormClose] = useState(shop.openingHours?.close || '20:00');
  const [formInstagram, setFormInstagram] = useState(shop.socialLinks?.instagram || '');
  const [formWhatsapp, setFormWhatsapp] = useState(shop.socialLinks?.whatsapp || '');
  const [formLat, setFormLat] = useState(shop.coordinates?.lat?.toString() || '');
  const [formLng, setFormLng] = useState(shop.coordinates?.lng?.toString() || '');

  // Reset form to shop values when toggling editing
  const handleToggleEdit = () => {
    if (!isEditing) {
      setFormName(shop.name || '');
      setFormTagline(shop.tagline || '');
      setFormAddress(shop.address || '');
      setFormCity(shop.city || '');
      setFormPhone(shop.phone || '');
      setFormEmail(shop.email || '');
      setFormLogo(shop.logo || '');
      setFormCover(shop.coverImage || '');
      setFormDays(shop.openingHours?.days || 'Lunes a Sábado');
      setFormOpen(shop.openingHours?.open || '09:00');
      setFormClose(shop.openingHours?.close || '20:00');
      setFormInstagram(shop.socialLinks?.instagram || '');
      setFormWhatsapp(shop.socialLinks?.whatsapp || '');
      setFormLat(shop.coordinates?.lat?.toString() || '');
      setFormLng(shop.coordinates?.lng?.toString() || '');
      setLocationSuccess(false);
    }
    setIsEditing(!isEditing);
  };

  // Automatic Geolocation using HTML5 Geolocation API + Nominatim Reverse Geocoding
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      addToast('Tu navegador no soporta geolocalización', 'error');
      return;
    }

    setIsLocating(true);
    setLocationSuccess(false);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setFormLat(lat.toFixed(6));
        setFormLng(lng.toFixed(6));

        try {
          // Reverse geocoding via OpenStreetMap Nominatim
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            {
              headers: {
                'Accept-Language': 'es',
              },
            }
          );

          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};

            const road = addr.road || addr.pedestrian || addr.street || addr.residential || '';
            const houseNumber = addr.house_number ? ` #${addr.house_number}` : '';
            const neighbourhood = addr.neighbourhood || addr.suburb || addr.quarter || '';
            const cityFound = addr.city || addr.town || addr.municipality || addr.village || addr.county || addr.state || '';

            let fullStreet = `${road}${houseNumber}`.trim();
            if (neighbourhood && fullStreet && !fullStreet.toLowerCase().includes(neighbourhood.toLowerCase())) {
              fullStreet += `, ${neighbourhood}`;
            }

            if (fullStreet) {
              setFormAddress(fullStreet);
            } else if (data.display_name) {
              setFormAddress(data.display_name.split(',').slice(0, 2).join(',').trim());
            }

            if (cityFound) {
              setFormCity(cityFound);
            }

            setLocationSuccess(true);
            addToast('Ubicación y dirección detectadas automáticamente', 'success');
          } else {
            setLocationSuccess(true);
            addToast('Coordenadas GPS obtenidas con éxito', 'info');
          }
        } catch {
          setLocationSuccess(true);
          addToast('Coordenadas GPS registradas con éxito', 'info');
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        let msg = 'No se pudo obtener la ubicación GPS.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Permiso denegado. Permite el acceso a tu ubicación en el navegador.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'La señal de ubicación no está disponible en este momento.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Tiempo agotado al consultar satélite GPS.';
        }
        addToast(msg, 'error');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedLat = parseFloat(formLat);
    const parsedLng = parseFloat(formLng);
    const coordinates = !isNaN(parsedLat) && !isNaN(parsedLng) ? { lat: parsedLat, lng: parsedLng } : undefined;

    const updates = {
      name: formName.trim() || shop.name,
      tagline: formTagline.trim(),
      address: formAddress.trim(),
      city: formCity.trim(),
      phone: formPhone.trim(),
      email: formEmail.trim(),
      logo: formLogo.trim() || shop.logo,
      coverImage: formCover.trim() || shop.coverImage,
      coordinates,
      openingHours: {
        days: formDays,
        open: formOpen,
        close: formClose,
      },
      socialLinks: {
        instagram: formInstagram.trim(),
        whatsapp: formWhatsapp.trim() || formPhone.trim(),
      },
    };

    barberStore.updateBarbershop(shop.id, updates);

    if (isLiveBackend) {
      updateShopProfile(shop.id, {
        name: updates.name,
        tagline: updates.tagline,
        logoUrl: updates.logo,
        coverUrl: updates.coverImage,
      })
        .then(() => refreshLiveData())
        .catch((e) => console.error('Error sincronizando perfil comercial:', e));
    }

    setIsEditing(false);
    addToast('Perfil comercial y ubicación guardados exitosamente', 'success');
  };

  const handleAddPhoto = (urlToAdd?: string) => {
    const photoUrl = (urlToAdd || photoInput).trim();
    if (!photoUrl) return;
    const res = barberStore.addPortfolioPhoto('barbershop', shop.id, photoUrl);
    if (!res.success) {
      addToast(res.error || 'Error al subir foto', 'error');
      return;
    }

    if (isLiveBackend) {
      const updatedPortfolio = [...shop.portfolio, photoUrl];
      updateShopProfile(shop.id, { portfolio: updatedPortfolio })
        .then(() => refreshLiveData())
        .catch((e) => console.error('Error sincronizando portafolio:', e));
    }

    addToast('Fotografía agregada a la galería oficial', 'success');
    setPhotoInput('');
  };

  const handleRemovePhoto = (index: number) => {
    barberStore.removePortfolioPhoto('barbershop', shop.id, index);

    if (isLiveBackend) {
      const updatedPortfolio = shop.portfolio.filter((_, i) => i !== index);
      updateShopProfile(shop.id, { portfolio: updatedPortfolio })
        .then(() => refreshLiveData())
        .catch((e) => console.error('Error sincronizando portafolio:', e));
    }

    addToast('Fotografía eliminada del portafolio', 'info');
  };

  // Sample curated barber photos presets for easy testing
  const samplePhotos = [
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=800&q=80',
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <BarberInvites />

      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#262626]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] font-semibold uppercase tracking-wider text-[var(--gold-primary)] mb-1">
            <Sparkles className="w-3 h-3" />
            <span>Identidad & Georreferenciación</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Perfil Comercial & Portafolio
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Gestiona la información pública de tu barbería, tu geolocalización GPS y la vitrina fotográfica oficial.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`#/b/${shop.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1c1c1c] border border-neutral-700/80 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-[#252525] transition-all"
            title="Ver página pública de reservas"
          >
            <Eye className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
            <span>Ver Vitrina</span>
          </a>

          <button
            onClick={handleToggleEdit}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${
              isEditing
                ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700 border border-neutral-600'
                : 'bg-[var(--gold-primary)] text-black hover:bg-[var(--gold-hover)] shadow-amber-500/10'
            }`}
          >
            {isEditing ? (
              <>
                <X className="w-4 h-4" />
                <span>Cancelar Edición</span>
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4" />
                <span>Editar Información</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Hero Showcase Card */}
      <div className="relative rounded-3xl overflow-hidden border border-[#2a2a2a] bg-[#121212] shadow-2xl transition-all">
        {/* Cover Background */}
        <div className="h-52 sm:h-64 w-full bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 relative overflow-hidden">
          {shop.coverImage ? (
            <img
              src={shop.coverImage}
              alt={shop.name}
              className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              onError={(e) => {
                // Graceful fallback if image link fails
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-radial from-amber-500/10 via-black to-black opacity-60">
              <Camera className="w-16 h-16 text-neutral-700" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/50 to-transparent" />
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Perfil Visible
            </span>
          </div>
        </div>

        {/* Brand Information Lockup */}
        <div className="px-6 pb-6 pt-0 relative -mt-16 sm:-mt-20 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
            <div className="relative group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-4 border-[#121212] bg-[#1a1a1a] shadow-2xl flex items-center justify-center shrink-0">
                {shop.logo ? (
                  <img
                    src={shop.logo}
                    alt={shop.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Store className="w-10 h-10 text-[var(--gold-primary)]" />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {shop.name || 'Barbería sin nombre'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  {shop.planId ? shop.planId.toUpperCase() : 'PLAN PRO'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-xl">
                {shop.tagline || 'Especialistas en corte clásico, perfilado de barba y cuidado masculino premium.'}
              </p>
            </div>
          </div>

          {/* Rating Badge */}
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-black/60 border border-neutral-800 backdrop-blur-md self-start md:self-end">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Star className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <div className="text-base font-extrabold text-white font-mono leading-none">
                {shop.rating ? shop.rating.toFixed(1) : '5.0'}{' '}
                <span className="text-xs font-normal text-neutral-400">/ 5.0</span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">{shop.reviewsCount || 0} valoraciones de clientes</p>
            </div>
          </div>
        </div>

        {/* Quick Info Grid */}
        <div className="mx-6 mb-6 p-4 rounded-2xl bg-[#171717]/80 border border-[#242424] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Address & City */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-[var(--gold-primary)] shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-neutral-500 block">Ubicación</span>
              <p className="text-white font-medium truncate">
                {shop.address || shop.city ? (
                  `${shop.address ? shop.address : ''}${shop.address && shop.city ? ', ' : ''}${shop.city ? shop.city : ''}`
                ) : (
                  <span className="text-neutral-500 italic">Sin dirección configurada</span>
                )}
              </p>
              {shop.coordinates && (
                <a
                  href={`https://www.google.com/maps?q=${shop.coordinates.lat},${shop.coordinates.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--gold-primary)] hover:underline mt-0.5"
                >
                  <span>Ver en Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-[var(--gold-primary)] shrink-0 mt-0.5">
              <Phone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-neutral-500 block">Teléfono / WhatsApp</span>
              <p className="text-white font-medium font-mono truncate">
                {shop.phone || <span className="text-neutral-500 italic font-sans">No registrado</span>}
              </p>
              {shop.phone && (
                <a
                  href={`https://wa.me/${shop.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-emerald-400 hover:underline block mt-0.5"
                >
                  Abrir WhatsApp
                </a>
              )}
            </div>
          </div>

          {/* Hours */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-[var(--gold-primary)] shrink-0 mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-neutral-500 block">Horario de Atención</span>
              <p className="text-white font-medium">
                {shop.openingHours?.days || 'Lunes a Sábado'}
              </p>
              <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                {shop.openingHours?.open || '09:00'} - {shop.openingHours?.close || '20:00'}
              </p>
            </div>
          </div>

          {/* Social / Email */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-[var(--gold-primary)] shrink-0 mt-0.5">
              <Globe className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-neutral-500 block">Canales Digitales</span>
              <p className="text-white font-medium truncate">
                {shop.email || 'contacto@barberia.com'}
              </p>
              {shop.socialLinks?.instagram && (
                <p className="text-[11px] text-pink-400 truncate mt-0.5">
                  @{shop.socialLinks.instagram.replace('@', '')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Editing Form */}
      {isEditing && (
        <form
          onSubmit={handleSaveProfile}
          className="rounded-3xl bg-[#121212] border-2 border-amber-500/40 p-6 sm:p-8 space-y-8 shadow-2xl relative animate-in fade-in slide-in-from-top-4 duration-300"
        >
          {/* Form Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-[var(--gold-primary)]" />
                <span>Editar Datos Comerciales & Ubicación</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Modifica los datos que los clientes verán en la aplicación y el portal web.
              </p>
            </div>
            <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
              Modo Edición Activo
            </span>
          </div>

          {/* Section 1: Basic Identity */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold-primary)]" />
              1. Identidad de la Marca
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-neutral-300 font-semibold block mb-1.5">
                  Nombre Comercial <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej. Barber Club Executive"
                    className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl pl-10 pr-3 py-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--gold-primary)] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-neutral-300 font-semibold block mb-1.5">Lema o Tagline</label>
                <input
                  type="text"
                  value={formTagline}
                  onChange={(e) => setFormTagline(e.target.value)}
                  placeholder="Ej. Experiencia clásica de barbería tradicional"
                  className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--gold-primary)] transition-colors"
                />
              </div>

              <div>
                <label className="text-neutral-300 font-semibold block mb-1.5">Teléfono Principal / WhatsApp</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+57 300 123 4567"
                    className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl pl-10 pr-3 py-2.5 text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-[var(--gold-primary)] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-neutral-300 font-semibold block mb-1.5">Correo Electrónico de Contacto</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="contacto@mibarberia.com"
                    className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl pl-10 pr-3 py-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--gold-primary)] transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Location & Automatic Geolocation Feature (Core Requirement) */}
          <div className="space-y-4 pt-2 border-t border-[#262626]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold-primary)]" />
                  2. Ubicación Física & Geocodificación Satelital
                </h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  La ubicación permite a los clientes encontrar tu local en el mapa y calcular distancias.
                </p>
              </div>

              {/* Automatic Geolocation Trigger Button */}
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isLocating}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
              >
                {isLocating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Detectando GPS y Dirección...</span>
                  </>
                ) : (
                  <>
                    <Crosshair className="w-4 h-4 text-black" />
                    <span>Tomar mi ubicación actual (GPS)</span>
                  </>
                )}
              </button>
            </div>

            {/* Geolocation feedback badge if detected */}
            {locationSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs text-emerald-300">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>¡Coordenadas y dirección detectadas con éxito!</strong> Puedes revisar o ajustar los datos abajo.
                  </span>
                </div>
                {formLat && formLng && (
                  <a
                    href={`https://www.google.com/maps?q=${formLat},${formLng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] underline text-emerald-200 hover:text-white shrink-0"
                  >
                    <span>Abrir mapa</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="lg:col-span-2">
                <label className="text-neutral-300 font-semibold block mb-1.5">
                  Dirección del Establecimiento (Calle, Número, Local)
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Ej. Calle 85 # 14-22, Local 102"
                    className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl pl-10 pr-3 py-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--gold-primary)] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-neutral-300 font-semibold block mb-1.5">Ciudad o Municipio</label>
                <input
                  type="text"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="Ej. Bogotá / Medellín / Madrid"
                  className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--gold-primary)] transition-colors"
                />
              </div>

              <div>
                <label className="text-neutral-300 font-semibold block mb-1.5 flex items-center justify-between">
                  <span>Latitud GPS</span>
                  <span className="text-[10px] text-neutral-500 font-mono">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={formLat}
                  onChange={(e) => setFormLat(e.target.value)}
                  placeholder="Ej. 4.60971"
                  className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl px-3.5 py-2.5 text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-[var(--gold-primary)] transition-colors"
                />
              </div>

              <div>
                <label className="text-neutral-300 font-semibold block mb-1.5 flex items-center justify-between">
                  <span>Longitud GPS</span>
                  <span className="text-[10px] text-neutral-500 font-mono">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={formLng}
                  onChange={(e) => setFormLng(e.target.value)}
                  placeholder="Ej. -74.08175"
                  className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl px-3.5 py-2.5 text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-[var(--gold-primary)] transition-colors"
                />
              </div>

              <div className="flex items-end">
                {formLat && formLng ? (
                  <a
                    href={`https://www.google.com/maps?q=${formLat},${formLng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-3 rounded-xl bg-[#1a1a1a] border border-neutral-700 hover:border-amber-500/50 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Navigation className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ver coordenadas en Mapa</span>
                  </a>
                ) : (
                  <div className="w-full py-2.5 px-3 rounded-xl bg-[#181818] border border-[#262626] text-neutral-500 text-xs flex items-center justify-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Sin coordenadas GPS</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Hours & Social Networks */}
          <div className="space-y-4 pt-2 border-t border-[#262626]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold-primary)]" />
              3. Horarios de Operación & Redes Sociales
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-neutral-300 font-semibold block mb-1.5">Días de Atención</label>
                <input
                  type="text"
                  value={formDays}
                  onChange={(e) => setFormDays(e.target.value)}
                  placeholder="Lunes a Sábado"
                  className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--gold-primary)] transition-colors"
                />
              </div>

              <div>
                <label className="text-neutral-300 font-semibold block mb-1.5">Hora de Apertura</label>
                <input
                  type="time"
                  value={formOpen}
                  onChange={(e) => setFormOpen(e.target.value)}
                  className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[var(--gold-primary)] transition-colors"
                />
              </div>

              <div>
                <label className="text-neutral-300 font-semibold block mb-1.5">Hora de Cierre</label>
                <input
                  type="time"
                  value={formClose}
                  onChange={(e) => setFormClose(e.target.value)}
                  className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-[var(--gold-primary)] transition-colors"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-neutral-300 font-semibold block mb-1.5">Usuario de Instagram</label>
                <div className="relative">
                  <Instagram className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={formInstagram}
                    onChange={(e) => setFormInstagram(e.target.value)}
                    placeholder="ej. @barberclub_oficial"
                    className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl pl-10 pr-3 py-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--gold-primary)] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-neutral-300 font-semibold block mb-1.5">Número de WhatsApp</label>
                <input
                  type="text"
                  value={formWhatsapp}
                  onChange={(e) => setFormWhatsapp(e.target.value)}
                  placeholder="ej. 573001234567"
                  className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl px-3.5 py-2.5 text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-[var(--gold-primary)] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Brand Visual Assets (Logo and Cover) */}
          <div className="space-y-4 pt-2 border-t border-[#262626]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold-primary)]" />
              4. Recursos Visuales (Logotipo y Portada)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <ImageUpload
                label="Logotipo Oficial"
                recommendedDimensions="400 x 400 px"
                value={formLogo}
                onChange={setFormLogo}
                kind="logo"
                tenantId={shop.id}
                aspectRatio="square"
              />

              <ImageUpload
                label="Foto de Portada"
                recommendedDimensions="1200 x 400 px"
                value={formCover}
                onChange={setFormCover}
                kind="cover"
                tenantId={shop.id}
                aspectRatio="banner"
              />
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-[#262626]">
            <button
              type="button"
              onClick={handleToggleEdit}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[var(--gold-primary)] hover:bg-[var(--gold-hover)] text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Perfil Comercial</span>
            </button>
          </div>
        </form>
      )}

      {/* Official Portfolio Gallery Section */}
      <div className="bg-[#121212] border border-[#262626] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        {/* Gallery Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
          <div>
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-[var(--gold-primary)]" />
              <h3 className="text-lg font-bold text-white">Galería Fotográfica Oficial</h3>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Muestra los mejores cortes, la atmósfera del local y los trabajos de tus barberos (hasta 10 fotos).
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Visual progress bar */}
            <div className="w-32 bg-neutral-800 h-2 rounded-full overflow-hidden hidden sm:block">
              <div
                className="bg-[var(--gold-primary)] h-full rounded-full transition-all duration-500"
                style={{ width: `${(shop.portfolio.length / 10) * 100}%` }}
              />
            </div>
            <span className="px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-[#1a1a1a] text-[var(--gold-primary)] border border-neutral-800 shadow-inner">
              {shop.portfolio.length} / 10 fotos
            </span>
          </div>
        </div>

        {/* Add Photo Input / Limit Warning */}
        {shop.portfolio.length < 10 ? (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-[#181818] border border-neutral-800">
              <span className="text-neutral-300 font-semibold block mb-2">Agregar fotografía a la galería</span>
              <ImageUpload
                value={photoInput}
                onChange={(url) => {
                  if (url) handleAddPhoto(url);
                }}
                kind="portfolio"
                tenantId={shop.id}
                aspectRatio="square"
              />
            </div>

            {/* Quick Presets for Demo / Testing */}
            {shop.portfolio.length === 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-neutral-400">
                <span className="text-[11px] text-neutral-500 font-medium">Sugerencias rápidas:</span>
                {samplePhotos.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      barberStore.addPortfolioPhoto('barbershop', shop.id, url);
                      addToast('Foto de ejemplo agregada a la galería', 'success');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] border border-neutral-800 text-[11px] text-neutral-300 hover:text-[var(--gold-primary)] transition-colors cursor-pointer"
                  >
                    + Agregar foto #{i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-300 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-bold">Capacidad máxima alcanzada (10 de 10 fotografías)</p>
              <p className="text-amber-200/80 text-[11px] mt-0.5">
                Para añadir nuevas imágenes a tu portafolio oficial, primero elimina alguna de las existentes.
              </p>
            </div>
          </div>
        )}

        {/* Gallery Grid */}
        {shop.portfolio.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
            {shop.portfolio.map((img, i) => (
              <div
                key={i}
                className="group relative rounded-2xl overflow-hidden border border-neutral-800 aspect-square bg-neutral-900 shadow-md hover:border-amber-500/50 transition-all"
              >
                <img
                  src={img}
                  alt={`Fotografía ${i + 1}`}
                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=400&q=80';
                  }}
                />

                {/* Overlay actions */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                  <button
                    type="button"
                    onClick={() => setPreviewModalImg(img)}
                    className="p-2 rounded-xl bg-black/70 hover:bg-neutral-800 text-white backdrop-blur-sm transition-transform hover:scale-110"
                    title="Ver imagen completa"
                  >
                    <Eye className="w-4 h-4 text-amber-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(i)}
                    className="p-2 rounded-xl bg-red-600/80 hover:bg-red-600 text-white backdrop-blur-sm transition-transform hover:scale-110"
                    title="Eliminar de la galería"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Index tag */}
                <span className="absolute bottom-2 left-2 text-[10px] font-mono font-bold bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-md text-amber-300 border border-neutral-800">
                  #{i + 1}
                </span>
              </div>
            ))}
          </div>
        ) : (
          /* High polish empty state */
          <div className="py-12 px-4 rounded-2xl border border-dashed border-neutral-800 bg-[#161616]/50 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[var(--gold-primary)]">
              <Camera className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Galería vacía</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
                Aún no has agregado fotos a tu portafolio. Agrega imágenes de calidad para que los clientes aprecien el trabajo y las instalaciones de tu barbería.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Full Photo Modal Viewer */}
      {previewModalImg && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewModalImg(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[85vh] rounded-3xl overflow-hidden border border-neutral-700 bg-neutral-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewModalImg(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/70 hover:bg-black text-white border border-neutral-700 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewModalImg}
              alt="Vista previa ampliada"
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
