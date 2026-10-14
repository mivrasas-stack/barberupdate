import React, { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { useApp } from '../../context/AppContext';
import { Camera, CheckCircle2, ArrowRight, Store, User, UserCheck } from 'lucide-react';
import { linkCustomer, resolveBusinessLink, isLiveBackend, type PublicBusinessLink } from '../../services/liveBackend';
import { useCustomerLinks } from '../../services/useCustomerLinks';

export const ClienteQRScanner: React.FC = () => {
  const { currentUser, addToast, navigate } = useApp();
  const { items, profile } = useCustomerLinks(currentUser?.id);
  const [manualCode, setManualCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkedResult, setLinkedResult] = useState<string | null>(null);
  const [pendingTarget, setPendingTarget] = useState<PublicBusinessLink | null>(null);
  const [selectedScope, setSelectedScope] = useState<'both' | 'barber' | 'shop'>('both');
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const working = useRef(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone);
    } else if (currentUser?.name) {
      setFullName(currentUser.name);
    }
  }, [profile, currentUser?.name]);

  useEffect(() => () => {
    controls.current?.stop();
    controls.current = null;
  }, []);

  const normalize = (value: string) => {
    const raw = value.trim();
    try {
      const url = new URL(raw);
      if (url.pathname.startsWith('/vincular/')) {
        return decodeURIComponent(url.pathname.split('/')[2] || '').toUpperCase();
      }
    } catch {}
    return raw.toUpperCase();
  };

  const stop = () => {
    controls.current?.stop();
    controls.current = null;
    setScanning(false);
  };

  const handleResolveAndPrepare = async (value: string) => {
    const code = normalize(value);
    if (!isLiveBackend) {
      addToast('Para vincular se requiere el backend real', 'error');
      return;
    }
    if (!code) return;
    setSaving(true);
    try {
      const target = await resolveBusinessLink(code);
      setPendingTarget(target);
      if (target.barber_name && target.business_kind === 'barbershop') {
        setSelectedScope('both');
      } else if (target.business_kind === 'independent') {
        setSelectedScope('both');
      } else {
        setSelectedScope('shop');
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'QR no válido', 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitLink = async () => {
    if (!pendingTarget) return;
    if (!fullName.trim() || !phone.trim()) {
      addToast('Completa tu nombre y teléfono para vincularte', 'error');
      return;
    }
    setSaving(true);
    try {
      const linked = await linkCustomer(pendingTarget.link_code, fullName.trim(), phone.trim(), selectedScope);
      const label = linked.barberName && selectedScope === 'barber'
        ? linked.barberName
        : linked.barberName && selectedScope === 'both'
        ? `${linked.barberName} y ${linked.name}`
        : linked.name;
      setLinkedResult(label);
      setPendingTarget(null);
      setManualCode('');
      addToast('Vinculación guardada con ' + label, 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'No se pudo vincular', 'error');
    } finally {
      setSaving(false);
    }
  };

  const camera = async () => {
    if (scanning) {
      stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      addToast('Activa HTTPS o usa localhost para escanear con cámara.', 'error');
      return;
    }
    if (!video.current) return;
    setScanning(true);
    working.current = false;
    try {
      const decoder = new BrowserQRCodeReader();
      controls.current = await decoder.decodeFromVideoDevice(undefined, video.current, (result, _, ctrl) => {
        if (result && !working.current) {
          working.current = true;
          const value = normalize(result.getText());
          setManualCode(value);
          ctrl.stop();
          stop();
          void handleResolveAndPrepare(value);
        }
      });
    } catch (e) {
      stop();
      addToast(e instanceof Error ? e.message : 'No se pudo acceder a la cámara', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="text-center pb-4 border-b border-[#242424]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">Conexión Directa</span>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Vincular Barbería o Barbero</h1>
        <p className="text-xs text-neutral-400 mt-1">Escanea el QR o ingresa el código real para asociarlo a tu cuenta.</p>
      </div>

      <div className="bg-[#141414] border border-[#262626] rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
        <div className="relative w-64 h-64 rounded-2xl bg-[#0a0a0a] border-2 border-dashed border-neutral-700 flex flex-col items-center justify-center overflow-hidden mb-4">
          <video ref={video} autoPlay muted playsInline className={'absolute inset-0 h-full w-full object-cover ' + (scanning ? '' : 'hidden')} />
          {!scanning && (
            <div className="space-y-2 p-4">
              <Camera className="w-10 h-10 text-neutral-600 mx-auto" />
              <span className="text-xs text-neutral-400 block">Apunta con la cámara al código QR impreso</span>
            </div>
          )}
        </div>
        <button
          onClick={() => void camera()}
          className="w-full py-3 rounded-xl bg-[var(--gold-primary)] text-black font-bold text-xs hover:bg-[var(--gold-hover)] transition-all flex items-center justify-center gap-2"
        >
          <Camera className="w-4 h-4" />
          {scanning ? 'Detener escáner' : 'Activar Escáner de Cámara'}
        </button>
      </div>

      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 space-y-3 text-xs">
        <label htmlFor="link-name" className="text-neutral-300 font-semibold block">Nombre y apellidos</label>
        <input
          id="link-name"
          type="text"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Tu nombre completo"
          className="w-full bg-[#181818] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white"
        />

        <label htmlFor="link-phone" className="text-neutral-300 font-semibold block">Teléfono de contacto</label>
        <input
          id="link-phone"
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+57 300 123 4567"
          className="w-full bg-[#181818] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white"
        />

        <label htmlFor="link-code" className="text-neutral-300 font-semibold block">O ingresa el código alfanumérico manualmente:</label>
        <div className="flex gap-2">
          <input
            id="link-code"
            type="text"
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            placeholder="Código que aparece bajo el QR"
            className="min-w-0 flex-1 bg-[#181818] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white font-mono uppercase"
          />
          <button
            onClick={() => void handleResolveAndPrepare(manualCode)}
            disabled={saving || !manualCode.trim()}
            className="px-5 py-2 rounded-xl bg-[#202020] hover:bg-[#282828] text-white font-bold disabled:opacity-50"
          >
            Buscar QR
          </button>
        </div>
      </div>

      {pendingTarget && (
        <div className="bg-[#181818] border border-[var(--gold-primary)]/40 rounded-2xl p-5 space-y-4">
          <div className="border-b border-[#2a2a2a] pb-3">
            <span className="text-[10px] uppercase font-bold text-[var(--gold-primary)] tracking-wider">QR Encontrado</span>
            <h3 className="text-base font-bold text-white mt-1">
              {pendingTarget.barber_name ? `${pendingTarget.barber_name} · ${pendingTarget.name}` : pendingTarget.name}
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              {pendingTarget.barber_name ? 'Código QR de profesional.' : 'Código QR de establecimiento.'}
            </p>
          </div>

          {pendingTarget.barber_name && pendingTarget.business_kind === 'barbershop' && (
            <div className="space-y-2 text-xs">
              <span className="font-semibold text-neutral-300 block">¿Cómo deseas vincularte?</span>
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                selectedScope === 'both' ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-white' : 'border-[#262626] bg-[#121212] text-neutral-300'
              }`}>
                <input
                  type="radio"
                  name="scannerScope"
                  value="both"
                  checked={selectedScope === 'both'}
                  onChange={() => setSelectedScope('both')}
                  className="mt-0.5 accent-amber-400"
                />
                <div>
                  <span className="font-bold block text-white flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                    Vincular con Ambos (Recomendado)
                  </span>
                  <span className="text-neutral-400">Sigues a {pendingTarget.barber_name} y a {pendingTarget.name}.</span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                selectedScope === 'barber' ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-white' : 'border-[#262626] bg-[#121212] text-neutral-300'
              }`}>
                <input
                  type="radio"
                  name="scannerScope"
                  value="barber"
                  checked={selectedScope === 'barber'}
                  onChange={() => setSelectedScope('barber')}
                  className="mt-0.5 accent-amber-400"
                />
                <div>
                  <span className="font-bold block text-white flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                    Solo con el Barbero ({pendingTarget.barber_name})
                  </span>
                  <span className="text-neutral-400">Te vinculas exclusivamente con el profesional.</span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                selectedScope === 'shop' ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-white' : 'border-[#262626] bg-[#121212] text-neutral-300'
              }`}>
                <input
                  type="radio"
                  name="scannerScope"
                  value="shop"
                  checked={selectedScope === 'shop'}
                  onChange={() => setSelectedScope('shop')}
                  className="mt-0.5 accent-amber-400"
                />
                <div>
                  <span className="font-bold block text-white flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                    Solo con la Barbería ({pendingTarget.name})
                  </span>
                  <span className="text-neutral-400">Te asocias al negocio en general.</span>
                </div>
              </label>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setPendingTarget(null)}
              className="flex-1 py-2.5 rounded-xl bg-[#262626] hover:bg-[#333] text-neutral-300 font-bold text-xs"
            >
              Cancelar
            </button>
            <button
              onClick={() => void submitLink()}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[var(--gold-primary)] hover:bg-[var(--gold-hover)] text-black font-extrabold text-xs disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Confirmar Vinculación'}
            </button>
          </div>
        </div>
      )}

      {linkedResult && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-bold text-white">Vinculado a {linkedResult}</p>
              <p className="text-neutral-300">Ya puedes reservar y consultar novedades de este negocio</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/clientes/citas/nueva')}
            className="px-3 py-2 bg-emerald-500 rounded-xl text-black flex items-center gap-1 font-bold whitespace-nowrap ml-2"
          >
            Reservar <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      <section className="bg-[#141414] border border-[#262626] rounded-2xl p-5 space-y-3">
        <h2 className="font-bold text-white text-sm">Mis barberías y profesionales vinculados</h2>
        {items.length === 0 ? (
          <p className="text-xs text-neutral-400">Todavía no tienes negocios vinculados. Escanea su QR para agregarlos.</p>
        ) : (
          items.map(item => (
            <div key={`${item.tenant_id}-${item.barber_id || 'general'}`} className="flex items-center justify-between gap-3 bg-[#1d1d1d] rounded-xl p-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                {item.barber_name ? <User className="w-4 h-4 text-[var(--gold-primary)] flex-shrink-0" /> : <Store className="w-4 h-4 text-[var(--gold-primary)] flex-shrink-0" />}
                <div className="truncate">
                  <span className="text-white font-medium block truncate">
                    {item.barber_name ? `${item.barber_name} · ${item.name}` : item.name}
                  </span>
                  {item.link_scope && (
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wide">
                      {item.link_scope === 'barber' ? 'Solo Barbero' : item.link_scope === 'shop' ? 'Solo Barbería' : 'Barbero y Barbería'}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigate('/clientes/citas/nueva')}
                className="text-[var(--gold-primary)] font-bold hover:underline whitespace-nowrap ml-2"
              >
                Reservar →
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
};
