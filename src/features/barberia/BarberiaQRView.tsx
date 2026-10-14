import React from 'react';
import { useApp } from '../../context/AppContext';
import { QrCode, Copy, Printer, ExternalLink, Check, Sparkles } from 'lucide-react';

export const BarberiaQRView: React.FC = () => {
  const { currentShop, addToast, navigate } = useApp();

  const shop = currentShop || { name: 'Barber Club Bogotá', publicCode: 'BCBOG-93', slug: 'barber-club' };
  const linkUrl = `${window.location.origin}/#vincular/${shop.publicCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(linkUrl);
    addToast('Enlace público de vinculación copiado al portapapeles', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center pb-4 border-b border-[#242424]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
          Fidelización Presencial
        </span>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Código QR de Vinculación</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Coloca este QR en tus espejos y recepción para que los clientes se vinculen de por vida con un escaneo
        </p>
      </div>

      {/* Printable QR Display Card */}
      <div className="bg-[#141414] border border-[#262626] rounded-3xl p-8 text-center shadow-2xl flex flex-col items-center relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 w-72 h-32 bg-[var(--gold-primary)]/10 blur-[80px] rounded-full pointer-events-none" />

        <div className="w-14 h-14 rounded-2xl bg-[var(--gold-primary)] text-black font-extrabold flex items-center justify-center mb-4 shadow-xl shadow-[var(--gold-primary)]/20">
          <QrCode className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-white">{shop.name}</h2>
        <p className="text-xs text-neutral-400 mt-1 max-w-sm">
          Escanea para agendar tu cita, pedir bebidas en la sala de espera y acumular puntos de fidelidad.
        </p>

        {/* QR Code Graphic Frame */}
        <div className="my-6 p-6 bg-white rounded-3xl shadow-2xl border-4 border-[var(--gold-primary)] inline-block">
          <div className="w-52 h-52 bg-white flex flex-col items-center justify-center relative">
            {/* SVG stylized QR pattern */}
            <svg viewBox="0 0 100 100" className="w-full h-full text-black">
              {/* Corner squares */}
              <rect x="5" y="5" width="25" height="25" fill="black" />
              <rect x="9" y="9" width="17" height="17" fill="white" />
              <rect x="13" y="13" width="9" height="9" fill="black" />

              <rect x="70" y="5" width="25" height="25" fill="black" />
              <rect x="74" y="9" width="17" height="17" fill="white" />
              <rect x="78" y="13" width="9" height="9" fill="black" />

              <rect x="5" y="70" width="25" height="25" fill="black" />
              <rect x="9" y="74" width="17" height="17" fill="white" />
              <rect x="13" y="78" width="9" height="9" fill="black" />

              {/* Data matrix dots simulation */}
              <rect x="35" y="10" width="6" height="6" fill="black" />
              <rect x="45" y="15" width="6" height="6" fill="black" />
              <rect x="55" y="10" width="6" height="6" fill="black" />
              <rect x="10" y="35" width="6" height="6" fill="black" />
              <rect x="25" y="45" width="6" height="6" fill="black" />
              <rect x="40" y="35" width="8" height="8" fill="black" />
              <rect x="55" y="40" width="6" height="6" fill="black" />
              <rect x="70" y="35" width="8" height="6" fill="black" />
              <rect x="85" y="45" width="6" height="6" fill="black" />
              <rect x="40" y="55" width="6" height="8" fill="black" />
              <rect x="55" y="60" width="8" height="6" fill="black" />
              <rect x="75" y="75" width="8" height="8" fill="black" />
              <rect x="40" y="75" width="6" height="6" fill="black" />
              <rect x="55" y="85" width="8" height="6" fill="black" />
              <rect x="85" y="85" width="6" height="6" fill="black" />

              {/* Center icon badge */}
              <rect x="42" y="42" width="16" height="16" rx="4" fill="#D9A323" />
            </svg>
          </div>
          <span className="block mt-2 font-mono font-bold text-xs text-black tracking-widest">
            {shop.publicCode}
          </span>
        </div>

        {/* Link preview */}
        <div className="w-full bg-[#181818] border border-[#262626] rounded-xl p-3 flex items-center justify-between text-xs text-neutral-300">
          <span className="truncate font-mono text-[11px] text-neutral-400">{linkUrl}</span>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-[#242424] hover:bg-[var(--gold-primary)] hover:text-black transition-colors shrink-0 ml-2"
            title="Copiar enlace"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action Controls */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 w-full">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 rounded-xl bg-[#202020] hover:bg-[#2a2a2a] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 border border-neutral-700"
          >
            <Printer className="w-4 h-4 text-[var(--gold-primary)]" />
            <span>Imprimir QR para Espejo</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex-1 py-3 rounded-xl bg-[var(--gold-primary)] hover:bg-[var(--gold-hover)] text-black font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[var(--gold-primary)]/10"
          >
            <Copy className="w-4 h-4" />
            <span>Copiar Enlace Directo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
