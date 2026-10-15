import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../../context/AppContext';
import { backendRequest } from '../../services/liveBackend';
import {
  QrCode,
  Copy,
  Check,
  Sparkles,
  Users,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

type Request = { id: string; full_name: string; status: string; created_at: string };

export function BarberInvites() {
  const { currentShop, addToast } = useApp();
  const [url, setUrl] = useState('');
  const [qr, setQr] = useState('');
  const [requests, setRequests] = useState<Request[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const tenant = currentShop?.id;

  const refresh = async () => {
    if (!tenant) return;
    setRefreshing(true);
    try {
      const data = await backendRequest<Request[]>('/tenants/' + tenant + '/barber-requests');
      setRequests(data || []);
    } catch {
      // Ignorar error silencioso en autorefresco
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [tenant]);

  const generate = async () => {
    if (!tenant) return;
    setBusy(true);
    try {
      const result = await backendRequest<{ code: string }>('/tenants/' + tenant + '/barber-invites', {
        method: 'POST'
      });
      const link = `${location.origin}/unirse-barbero/${result.code}`;
      setCopied(false);
      setUrl(link);
      const qrData = await QRCode.toDataURL(link, {
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#0a0a0a',
          light: '#ffffff'
        }
      });
      setQr(qrData);
      addToast('Invitación premium generada con éxito', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'No se pudo crear la invitación', 'error');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      addToast('Enlace de invitación copiado al portapapeles', 'success');
      // Copiado se reinicia al regenerar el enlace.
    } catch {
      addToast('Error al copiar el enlace', 'error');
    }
  };

  const decide = async (id: string, approve: boolean) => {
    if (!tenant) return;
    try {
      await backendRequest('/tenants/' + tenant + '/barber-requests/' + id + '/decision', {
        method: 'POST',
        body: JSON.stringify({ approve })
      });
      await refresh();
      addToast(approve ? 'Barbero admitido en el equipo' : 'Solicitud rechazada', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error al procesar solicitud', 'error');
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center pb-3 border-b border-neutral-800">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Sparkles className="w-3 h-3" /> Reclutamiento & Equipo
        </span>
        <h1 className="text-2xl font-black text-white tracking-tight mt-2">
          Vinculación de Barberos
        </h1>
        <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
          Genera un acceso exclusivo y seguro para sumar nuevos profesionales a tu equipo.
        </p>
      </div>

      {/* Main Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-neutral-900 via-[#141414] to-[#0d0d0d] border border-amber-500/30 p-6 sm:p-8 shadow-2xl text-center flex flex-col items-center">
        {/* Glow ambient background */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-80 h-36 bg-amber-500/15 blur-[90px] rounded-full pointer-events-none" />

        {/* Badge Icon */}
        <div className="relative mb-3 flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-300 text-neutral-950 shadow-lg shadow-amber-500/20">
          <QrCode className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-extrabold text-white tracking-tight">
          {currentShop?.name || 'Tu Barbería'}
        </h2>
        <div className="flex items-center justify-center gap-4 text-xs text-neutral-400 mt-2 mb-6">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> Válido por 7 días
          </span>
          <span className="w-1 h-1 rounded-full bg-neutral-600" />
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Aprobación manual
          </span>
        </div>

        {/* Generate / Action Button */}
        <button
          type="button"
          disabled={busy}
          onClick={() => void generate()}
          className="relative group overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 active:scale-[0.98] transition-all duration-200 text-neutral-950 font-bold px-6 py-3 text-sm shadow-xl shadow-amber-500/10 disabled:opacity-50 flex items-center gap-2"
        >
          {busy ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Generando credencial QR...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{qr ? 'Regenerar nuevo QR' : 'Generar invitación para barberos'}</span>
            </>
          )}
        </button>

        {/* QR Section */}
        {qr && (
          <div className="mt-7 flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
            <div className="relative p-5 bg-white rounded-2xl shadow-2xl ring-4 ring-amber-400/30 border-2 border-amber-400/50">
              <img
                src={qr}
                alt="QR de invitación para barberos"
                width={220}
                height={220}
                className="w-52 h-52 object-contain"
              />
              <div className="absolute inset-x-0 bottom-2 text-center">
                <span className="text-[10px] font-mono tracking-wider font-bold text-neutral-800 uppercase bg-neutral-100/90 px-2 py-0.5 rounded">
                  Escaneo Exclusivo Barberos
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-400 mt-3 font-medium">
              Muestra este código al barbero para que complete su postulación.
            </p>
          </div>
        )}

        {/* Enlace y botón copiar */}
        {url && (
          <div className="mt-5 w-full bg-black/60 border border-neutral-800 rounded-xl p-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1 px-1">
              <ExternalLink className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span className="truncate font-mono text-xs text-neutral-300 select-all">
                {url}
              </span>
            </div>
            <button
              onClick={() => void copyLink()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-amber-400 hover:text-black text-neutral-200 text-xs font-semibold transition-colors duration-150 shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Solicitudes Pendientes Section */}
      <div className="rounded-3xl bg-[#141414] border border-neutral-800 p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm text-white">Solicitudes de ingreso</h3>
            {pendingRequests.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                {pendingRequests.length}
              </span>
            )}
          </div>
          <button
            onClick={() => void refresh().catch((e) => addToast(String(e), 'error'))}
            disabled={refreshing}
            className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-amber-400 transition-colors disabled:opacity-50"
            title="Refrescar solicitudes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {pendingRequests.length === 0 ? (
            <div className="py-6 text-center text-xs text-neutral-500 flex flex-col items-center gap-1">
              <Users className="w-6 h-6 text-neutral-600 mb-1" />
              <span>No hay solicitudes pendientes de aprobación.</span>
              <span className="text-[11px] text-neutral-600">
                Aparecerán aquí automáticamente cuando un barbero escanee el código.
              </span>
            </div>
          ) : (
            pendingRequests.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between flex-wrap gap-3 bg-neutral-900/70 border border-neutral-800/80 rounded-xl p-3.5 hover:border-neutral-700 transition-colors"
              >
                <div>
                  <p className="font-semibold text-sm text-white">{r.full_name}</p>
                  <span className="text-[10px] text-neutral-500">
                    Solicitud recibida
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void decide(r.id, true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/30 text-xs font-bold transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Aprobar
                  </button>
                  <button
                    onClick={() => void decide(r.id, false)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-bold transition-all"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Rechazar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
