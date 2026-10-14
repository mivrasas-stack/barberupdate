import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ThemePalette } from '../../types';
import { X, Check, Palette, RotateCcw, Sparkles } from 'lucide-react';

export const PaletteValidatorModal: React.FC = () => {
  const { isPaletteModalOpen, setIsPaletteModalOpen, activePalette, allPalettes, setActivePalette, updateCustomPalette, addToast } = useApp();
  
  const [customDraft, setCustomDraft] = useState<ThemePalette>({
    ...activePalette,
    id: 'custom-user-palette',
    name: 'Paleta Personalizada en Vivo',
  });

  if (!isPaletteModalOpen) return null;

  const handleSelectPreset = (p: ThemePalette) => {
    setActivePalette(p.id);
    setCustomDraft({
      ...p,
      id: 'custom-user-palette',
      name: 'Paleta Personalizada en Vivo',
    });
    addToast(`Paleta activada: ${p.name}`, 'success');
  };

  const handleApplyCustom = () => {
    updateCustomPalette(customDraft);
    addToast('Paleta personalizada aplicada exitosamente en todo el sistema', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl animate-apple-enter">
      <div className="relative w-full max-w-2xl bg-[#141418]/90 backdrop-blur-3xl border border-white/[0.12] rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)] p-6 sm:p-7 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-b from-[#f3c048]/20 to-[#b88928]/10 border border-[#D9A323]/40 flex items-center justify-center text-[#D9A323] shadow-inner">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-white tracking-tight">Validador de Paletas de Color</h3>
              <p className="text-xs text-neutral-400">Prueba y valida en tiempo real la combinación cromática de BarberOS</p>
            </div>
          </div>
          <button
            onClick={() => setIsPaletteModalOpen(false)}
            className="p-2 text-neutral-400 hover:text-white rounded-full bg-white/[0.04] hover:bg-white/[0.08] transition-all cursor-pointer active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-6 space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {/* Presets */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--gold-primary)] block mb-3">
              Paletas Preconfiguradas
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allPalettes.map(palette => {
                const isSelected = activePalette.id === palette.id;
                return (
                  <button
                    key={palette.id}
                    onClick={() => handleSelectPreset(palette)}
                    className={`flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-98 ${
                      isSelected
                        ? 'border-[var(--gold-primary)] bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[0_8px_25px_rgba(217,163,35,0.15)] ring-1 ring-[var(--gold-primary)]/50'
                        : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white">{palette.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#D9A323]" />}
                    </div>
                    {/* Color Swatches */}
                    <div className="flex items-center gap-1.5 mt-auto pt-2.5 border-t border-white/[0.06]">
                      <div className="w-6 h-6 rounded-lg border border-white/20 shadow-sm" style={{ backgroundColor: palette.bgPrimary }} title="Fondo Principal" />
                      <div className="w-6 h-6 rounded-lg border border-white/20 shadow-sm" style={{ backgroundColor: palette.bgSurface }} title="Superficie Tarjetas" />
                      <div className="w-6 h-6 rounded-lg border border-white/20 shadow-sm" style={{ backgroundColor: palette.borderSubtle }} title="Bordes" />
                      <div className="w-6 h-6 rounded-lg border border-white/20 shadow-sm" style={{ backgroundColor: palette.goldPrimary }} title="Dorado / Acento" />
                      <span className="ml-auto text-[11px] font-mono text-neutral-400 font-bold">{palette.goldPrimary}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="p-4 rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-md shadow-inner">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-3">
              Previsualización de Componente en Vivo
            </span>
            <div
              className="p-4 rounded-xl border transition-all"
              style={{
                backgroundColor: activePalette.bgSurface,
                borderColor: activePalette.borderSubtle,
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: activePalette.goldPrimary }}>
                    Barbería Exclusiva
                  </span>
                  <h4 className="text-base font-bold" style={{ color: activePalette.textPrimary }}>
                    Corte Clásico & Degradado Ejecutivo
                  </h4>
                  <p className="text-xs mt-1" style={{ color: activePalette.textMuted }}>
                    Lavado mentolado, toalla caliente y perfilado a navaja
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold font-mono" style={{ color: activePalette.goldPrimary }}>
                    $ 45.000 COP
                  </span>
                  <div className="mt-2">
                    <button
                      className="px-3.5 py-1.5 text-xs font-bold rounded-lg transition-transform active:scale-95"
                      style={{
                        backgroundColor: activePalette.goldPrimary,
                        color: '#090909',
                      }}
                    >
                      Reservar Cita
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Tuner */}
          <div className="p-4 rounded-xl border border-[#262626] bg-[#161616]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                Afinador de Colores Hexadecimal
              </span>
              <span className="text-[11px] text-[#D9A323] flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Ajustes en vivo
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Fondo Principal</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customDraft.bgPrimary}
                    onChange={e => setCustomDraft({ ...customDraft, bgPrimary: e.target.value })}
                    className="w-8 h-8 rounded border border-neutral-700 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={customDraft.bgPrimary}
                    onChange={e => setCustomDraft({ ...customDraft, bgPrimary: e.target.value })}
                    className="w-full text-xs font-mono bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Superficie Tarjetas</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customDraft.bgSurface}
                    onChange={e => setCustomDraft({ ...customDraft, bgSurface: e.target.value })}
                    className="w-8 h-8 rounded border border-neutral-700 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={customDraft.bgSurface}
                    onChange={e => setCustomDraft({ ...customDraft, bgSurface: e.target.value })}
                    className="w-full text-xs font-mono bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Bordes Sutiles</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customDraft.borderSubtle}
                    onChange={e => setCustomDraft({ ...customDraft, borderSubtle: e.target.value })}
                    className="w-8 h-8 rounded border border-neutral-700 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={customDraft.borderSubtle}
                    onChange={e => setCustomDraft({ ...customDraft, borderSubtle: e.target.value })}
                    className="w-full text-xs font-mono bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Acento Dorado</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customDraft.goldPrimary}
                    onChange={e => setCustomDraft({ ...customDraft, goldPrimary: e.target.value })}
                    className="w-8 h-8 rounded border border-neutral-700 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={customDraft.goldPrimary}
                    onChange={e => setCustomDraft({ ...customDraft, goldPrimary: e.target.value })}
                    className="w-full text-xs font-mono bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={handleApplyCustom}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[#D9A323] text-black hover:bg-[#b88928] transition-colors"
              >
                Aplicar Color Personalizado
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-[#262626] flex items-center justify-between text-xs text-neutral-400">
          <span>Paleta activa actualmente: <strong className="text-white">{activePalette.name}</strong></span>
          <button
            onClick={() => setIsPaletteModalOpen(false)}
            className="px-4 py-2 font-medium text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
          >
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
