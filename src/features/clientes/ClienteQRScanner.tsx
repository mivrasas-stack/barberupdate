import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { QrCode, Camera, CheckCircle2, ArrowRight, Store, Scissors, Search } from 'lucide-react';

export const ClienteQRScanner: React.FC = () => {
  const { state, addToast, navigate } = useApp();
  const [manualCode, setManualCode] = useState('');
  const [isScanningSimulated, setIsScanningSimulated] = useState(false);
  const [linkedResult, setLinkedResult] = useState<{ name: string; type: 'shop' | 'barber'; targetId: string } | null>(null);

  const handleLinkByCode = (codeToUse?: string) => {
    const code = (codeToUse || manualCode).trim().toUpperCase();
    if (!code) return;

    // Search in shops
    const shop = state.barbershops.find(s => s.publicCode.toUpperCase() === code);
    if (shop) {
      setLinkedResult({ name: shop.name, type: 'shop', targetId: shop.id });
      addToast(`¡Vinculado exitosamente con ${shop.name}!`, 'success');
      return;
    }

    // Search in barbers
    const barber = state.barbers.find(b => b.publicCode.toUpperCase() === code);
    if (barber) {
      setLinkedResult({ name: barber.name, type: 'barber', targetId: barber.id });
      addToast(`¡Vinculado exitosamente con ${barber.name}!`, 'success');
      return;
    }

    addToast(`Código "${code}" no encontrado. Prueba con BCBOG-93 o FADE-ALEX.`, 'error');
  };

  const handleSimulateCameraScan = () => {
    setIsScanningSimulated(true);
    setTimeout(() => {
      setIsScanningSimulated(false);
      handleLinkByCode('BCBOG-93'); // Simulate scanning Barber Club Bogotá QR
    }, 1500);
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="text-center pb-4 border-b border-[#242424]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
          Conexión Directa
        </span>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Vincular Barbería o Barbero</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Escanea el código QR del espejo o ingresa el código manual para agregarlo a tus favoritos
        </p>
      </div>

      {/* Camera Simulator Box */}
      <div className="bg-[#141414] border border-[#262626] rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
        <div className="relative w-64 h-64 rounded-2xl bg-[#0a0a0a] border-2 border-dashed border-neutral-700 flex flex-col items-center justify-center overflow-hidden mb-4">
          {isScanningSimulated ? (
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full border-4 border-[var(--gold-primary)] border-t-transparent animate-spin mx-auto" />
              <span className="text-xs text-[var(--gold-primary)] font-bold font-mono">Enfocando QR con cámara...</span>
            </div>
          ) : (
            <div className="space-y-2 p-4">
              <Camera className="w-10 h-10 text-neutral-600 mx-auto" />
              <span className="text-xs text-neutral-400 block">Apunta con la cámara al código QR impreso</span>
            </div>
          )}

          {/* Scanner horizontal line */}
          {isScanningSimulated && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--gold-primary)] shadow-[0_0_15px_#D9A323] animate-pulse" />
          )}
        </div>

        <button
          onClick={handleSimulateCameraScan}
          disabled={isScanningSimulated}
          className="w-full py-3 rounded-xl bg-[var(--gold-primary)] text-black font-bold text-xs hover:bg-[var(--gold-hover)] transition-all shadow-md flex items-center justify-center gap-2"
        >
          <Camera className="w-4 h-4" />
          <span>Activar Escáner de Cámara</span>
        </button>
      </div>

      {/* Manual Input Alternative */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 space-y-3 text-xs">
        <span className="text-neutral-300 font-semibold block">O ingresa el código alfanumérico manualmente:</span>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            placeholder="Ej. BCBOG-93 o FADE-ALEX"
            className="flex-1 bg-[#181818] border border-[#2a2a2a] rounded-xl px-3 py-2 text-white font-mono uppercase"
          />
          <button
            onClick={() => handleLinkByCode()}
            className="px-5 py-2 rounded-xl bg-[#202020] hover:bg-[#282828] text-white font-bold transition-colors"
          >
            Vincular
          </button>
        </div>

        <div className="pt-2 text-[11px] text-neutral-500">
          Códigos de prueba: <button onClick={() => handleLinkByCode('BCBOG-93')} className="text-[var(--gold-primary)] hover:underline font-mono">BCBOG-93</button> · <button onClick={() => handleLinkByCode('FADE-ALEX')} className="text-orange-400 hover:underline font-mono">FADE-ALEX</button>
        </div>
      </div>

      {/* Result Card */}
      {linkedResult && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 text-emerald-400">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div>
              <div className="font-bold text-white">Vinculado a {linkedResult.name}</div>
              <div className="text-[11px] text-neutral-300">Ya puedes agendar citas directamente con ellos</div>
            </div>
          </div>
          <button
            onClick={() => navigate('/clientes/citas/nueva')}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-black font-bold flex items-center gap-1"
          >
            <span>Reservar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
