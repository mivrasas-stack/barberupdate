import React, { useEffect, useState, useMemo } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../../context/AppContext';
import { QrCode, Copy, Printer, User, Store } from 'lucide-react';
import { isLiveBackend, getBusinessLinkCode } from '../../services/liveBackend';

export const BarberiaQRView: React.FC = () => {
  const { currentShop, currentBarber, currentUser, state, activeRoute, addToast } = useApp();
  const [link, setLink] = useState('');
  const [qrImage, setQrImage] = useState('');
  const [error, setError] = useState('');
  const [selectedBarberId, setSelectedBarberId] = useState<string>('');

  const isBarberView = activeRoute.startsWith('/barbero/') || 
    currentUser?.role === 'barber_employee' || 
    currentUser?.role === 'barber_independent';

  // For barbers, resolve their own barber profile
  const barberProfile = useMemo(() => {
    if (isBarberView) {
      return currentBarber || state.barbers.find(b => b.id === currentUser?.barberId) || null;
    }
    if (selectedBarberId) {
      return state.barbers.find(b => b.id === selectedBarberId) || null;
    }
    return null;
  }, [isBarberView, currentBarber, currentUser?.barberId, state.barbers, selectedBarberId]);

  const shopBarbers = useMemo(() => {
    if (!currentShop?.id) return [];
    return state.barbers.filter(b => b.businessId === currentShop.id);
  }, [state.barbers, currentShop?.id]);

  const tenantId = currentShop?.id || barberProfile?.businessId;

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    (async () => {
      try {
        if (!isLiveBackend) throw Error('El QR requiere conexión con el backend real.');
        const targetBarberId = isBarberView ? barberProfile?.id : (selectedBarberId || undefined);
        const data = await getBusinessLinkCode(tenantId, targetBarberId);
        const url = window.location.origin + '/vincular/' + encodeURIComponent(data.link_code);
        const image = await QRCode.toDataURL(url, {
          width: 360,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: { dark: '#000000', light: '#ffffff' }
        });
        if (alive) {
          setLink(url);
          setQrImage(image);
          setError('');
        }
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : 'No se pudo generar el QR');
          setLink('');
          setQrImage('');
        }
      }
    })();
    return () => { alive = false; };
  }, [tenantId, isBarberView, barberProfile?.id, selectedBarberId]);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      addToast('Enlace de vinculación copiado al portapapeles', 'success');
    } catch {
      addToast('No se pudo copiar el enlace; selecciónalo manualmente.', 'error');
    }
  };

  const displayName = isBarberView 
    ? (barberProfile?.name || currentUser?.name || 'Mi Perfil Profesional')
    : (barberProfile ? `${barberProfile.name} (Espejo)` : (currentShop?.name || 'Mi Negocio'));

  const displaySubtitle = isBarberView
    ? (currentShop?.name ? `Profesional en ${currentShop.name}` : 'Profesional Independiente')
    : (barberProfile 
        ? `Código de espejo individual para ${barberProfile.name}` 
        : 'Escanea para registrarte, agendar citas y seguir a la barbería o a tus profesionales favoritos.');

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center pb-4 border-b border-[#242424]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
          {isBarberView ? 'Fidelización del Profesional' : 'Fidelización Presencial'}
        </span>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          {isBarberView ? 'Mi Código QR Personal' : 'Código QR de Vinculación'}
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          {isBarberView
            ? 'Coloca este QR en tu espejo para que tus clientes se vinculen directamente contigo y tu barbería'
            : 'Coloca este QR en recepción o vitrina para que los clientes se vinculen con un escaneo'}
        </p>
      </div>

      {!isBarberView && shopBarbers.length > 0 && (
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-neutral-300 font-semibold">Seleccionar vista de QR:</span>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setSelectedBarberId('')}
              className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                !selectedBarberId ? 'bg-[var(--gold-primary)] text-black' : 'bg-[#202020] text-neutral-300 hover:bg-[#282828]'
              }`}
            >
              <Store className="w-3.5 h-3.5" /> General Barbería
            </button>
            <select
              value={selectedBarberId}
              onChange={e => setSelectedBarberId(e.target.value)}
              className="flex-1 sm:flex-initial bg-[#1e1e1e] border border-[#333] text-white rounded-xl px-3 py-2 font-medium"
            >
              <option value="">-- QR de Espejo de Barbero --</option>
              {shopBarbers.map(b => (
                <option key={b.id} value={b.id}>
                  Espejo: {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="bg-[#141414] border border-[#262626] rounded-3xl p-8 text-center shadow-2xl flex flex-col items-center relative overflow-hidden">
        <div className="absolute top-0 w-72 h-32 bg-[var(--gold-primary)]/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="w-14 h-14 rounded-2xl bg-[var(--gold-primary)] text-black flex items-center justify-center mb-4">
          {isBarberView || barberProfile ? <User className="w-8 h-8" /> : <QrCode className="w-8 h-8" />}
        </div>
        <h2 className="text-xl font-bold text-white">{displayName}</h2>
        <p className="text-xs text-neutral-400 mt-1 max-w-sm">{displaySubtitle}</p>

        {error && (
          <p role="alert" className="text-red-400 text-sm mt-4 bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-2">
            {error}
          </p>
        )}

        <div className="my-6 p-6 bg-white rounded-3xl shadow-2xl border-4 border-[var(--gold-primary)] inline-block">
          {qrImage ? (
            <img src={qrImage} alt={'QR de ' + displayName} className="w-52 h-52" data-testid="real-business-qr" />
          ) : (
            <div className="w-52 h-52 flex items-center justify-center text-neutral-500 text-xs">
              Preparando QR seguro...
            </div>
          )}
          <span className="block mt-2 font-mono font-bold text-[10px] text-black tracking-wide">
            {link.split('/').pop() || '—'}
          </span>
        </div>

        <div className="w-full bg-[#181818] border border-[#262626] rounded-xl p-3 flex items-center justify-between text-xs text-neutral-300">
          <span className="truncate font-mono text-[11px] text-neutral-400" title={link}>
            {link || 'Generando enlace...'}
          </span>
          <button
            onClick={() => void copy()}
            disabled={!link}
            className="p-1.5 rounded-lg bg-[#242424] hover:bg-[var(--gold-primary)] hover:text-black disabled:opacity-40"
            title="Copiar enlace"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 w-full">
          <button
            onClick={() => window.print()}
            disabled={!qrImage}
            className="flex-1 py-3 rounded-xl bg-[#202020] hover:bg-[#2a2a2a] text-white font-semibold text-xs flex items-center justify-center gap-2 border border-neutral-700 disabled:opacity-40"
          >
            <Printer className="w-4 h-4 text-[var(--gold-primary)]" />
            {isBarberView ? 'Imprimir QR para mi Espejo' : 'Imprimir QR'}
          </button>
          <button
            onClick={() => void copy()}
            disabled={!link}
            className="flex-1 py-3 rounded-xl bg-[var(--gold-primary)] hover:bg-[var(--gold-hover)] text-black font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Copy className="w-4 h-4" /> Copiar Enlace Directo
          </button>
        </div>

        <p className="text-[11px] text-neutral-500 mt-4">
          Para escanear desde otro teléfono necesitas que esta web esté publicada con HTTPS y una dirección accesible para ese teléfono.
        </p>
      </div>
    </div>
  );
};
