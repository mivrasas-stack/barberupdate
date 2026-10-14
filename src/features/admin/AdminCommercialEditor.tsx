import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { barberStore } from '../../services/store';
import {isLiveBackend} from '../../services/liveBackend';
import { formatCurrency } from '../../utils/formatters';
import {
  Globe,
  Monitor,
  Smartphone,
  Save,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Plus,
  Trash2,
  Check,
} from 'lucide-react';
import { CommercialPageConfig } from '../../types';

export const AdminCommercialEditor: React.FC = () => {
  const { state, currency, addToast } = useApp();
  const [draft, setDraft] = useState<CommercialPageConfig>({ ...state.commercialConfig });
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'hero' | 'benefits' | 'faqs'>('hero');

  const handleSave = () => {
    if(isLiveBackend){addToast('La publicación comercial todavía requiere conectar el editor al backend. No se aplicaron cambios.', 'error');return;}
    barberStore.updateCommercialConfig(draft);
    addToast('Página comercial publicada con éxito en el entorno de demostración', 'success');
  };

  const handleAddFaq = () => {
    setDraft({
      ...draft,
      faqs: [
        ...draft.faqs,
        {
          question: 'Nueva pregunta frecuente',
          answer: 'Escribe aquí la respuesta para tus clientes comerciales.',
        },
      ],
    });
  };

  const handleRemoveFaq = (index: number) => {
    const next = [...draft.faqs];
    next.splice(index, 1);
    setDraft({ ...draft, faqs: next });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#242424]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-primary)]">
            Marketing & Conversión
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Editor Visual de Precios</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Modifica los textos, beneficios y FAQs de la página pública de tarifas en tiempo real
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Device Preview Toggle */}
          <div className="flex items-center gap-1 p-1 bg-[#161616] border border-[#2a2a2a] rounded-xl">
            <button
              onClick={() => setPreviewDevice('desktop')}
              className={`p-2 rounded-lg transition-colors ${
                previewDevice === 'desktop' ? 'bg-[var(--gold-primary)] text-black' : 'text-neutral-400 hover:text-white'
              }`}
              title="Vista Escritorio"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPreviewDevice('mobile')}
              className={`p-2 rounded-lg transition-colors ${
                previewDevice === 'mobile' ? 'bg-[var(--gold-primary)] text-black' : 'text-neutral-400 hover:text-white'
              }`}
              title="Vista Móvil"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={isLiveBackend}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black text-xs font-bold hover:bg-[var(--gold-hover)] transition-all shadow-lg shadow-[var(--gold-primary)]/10"
          >
            <Save className="w-4 h-4" />
            <span>{isLiveBackend?'Publicación no disponible':'Publicar Cambios'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-5 bg-[#141414] border border-[#262626] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-neutral-800 text-xs">
            {(
              [
                { id: 'hero', label: 'Encabezado' },
                { id: 'benefits', label: 'Beneficios' },
                { id: 'faqs', label: 'Preguntas Frecuentes' },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === tab.id ? 'bg-[var(--gold-primary)] text-black font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'hero' && (
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Título Principal (Hero H1)</label>
                <textarea
                  rows={2}
                  value={draft.heroTitle}
                  onChange={e => setDraft({ ...draft, heroTitle: e.target.value })}
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Subtítulo Descriptivo</label>
                <textarea
                  rows={3}
                  value={draft.heroSubtitle}
                  onChange={e => setDraft({ ...draft, heroSubtitle: e.target.value })}
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Frase Destacada de Confianza</label>
                <input
                  type="text"
                  value={draft.highlightPhrase}
                  onChange={e => setDraft({ ...draft, highlightPhrase: e.target.value })}
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Texto Botón Llamada a la Acción (CTA)</label>
                <input
                  type="text"
                  value={draft.ctaButtonText}
                  onChange={e => setDraft({ ...draft, ctaButtonText: e.target.value })}
                  className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg p-2 text-white"
                />
              </div>
            </div>
          )}

          {activeTab === 'benefits' && (
            <div className="space-y-3 text-xs">
              <span className="text-[11px] text-neutral-400 block">
                Edita los pilares comerciales visibles para prospectos:
              </span>
              {draft.benefits.map((b, i) => (
                <div key={i} className="p-3 bg-[#181818] rounded-xl border border-neutral-800 space-y-2">
                  <input
                    type="text"
                    value={b.title}
                    onChange={e => {
                      const next = [...draft.benefits];
                      next[i].title = e.target.value;
                      setDraft({ ...draft, benefits: next });
                    }}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white font-bold"
                  />
                  <textarea
                    rows={2}
                    value={b.desc}
                    onChange={e => {
                      const next = [...draft.benefits];
                      next[i].desc = e.target.value;
                      setDraft({ ...draft, benefits: next });
                    }}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-neutral-300"
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'faqs' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-neutral-400">Respuestas a objeciones:</span>
                <button
                  onClick={handleAddFaq}
                  className="text-[11px] text-[var(--gold-primary)] font-bold flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3 h-3" /> Añadir Pregunta
                </button>
              </div>

              {draft.faqs.map((faq, i) => (
                <div key={i} className="p-3 bg-[#181818] rounded-xl border border-neutral-800 space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-neutral-500">FAQ #{i + 1}</span>
                    {draft.faqs.length > 1 && (
                      <button
                        onClick={() => handleRemoveFaq(i)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={faq.question}
                    onChange={e => {
                      const next = [...draft.faqs];
                      next[i].question = e.target.value;
                      setDraft({ ...draft, faqs: next });
                    }}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white font-semibold"
                  />
                  <textarea
                    rows={2}
                    value={faq.answer}
                    onChange={e => {
                      const next = [...draft.faqs];
                      next[i].answer = e.target.value;
                      setDraft({ ...draft, faqs: next });
                    }}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-neutral-300"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Live Responsive Preview Sandbox */}
        <div className="lg:col-span-7 bg-[#0d0d0d] border border-[#262626] rounded-2xl p-4 flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-neutral-800 text-xs text-neutral-400">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Previsualización en tiempo real ({previewDevice === 'desktop' ? '1440px Escritorio' : '390px Móvil'})
            </span>
            <span className="text-[10px] text-neutral-500 font-mono">Vista previa sin publicar</span>
          </div>

          <div
            className={`transition-all duration-300 bg-[#090909] border border-neutral-800 rounded-2xl shadow-2xl p-6 overflow-y-auto max-h-[700px] w-full ${
              previewDevice === 'mobile' ? 'max-w-sm border-neutral-700' : 'w-full'
            }`}
          >
            {/* Live Rendered Landing Header */}
            <div className="text-center py-6 border-b border-neutral-800">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] border border-[var(--gold-primary)]/20 text-[11px] font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Plataforma SaaS para Barberías</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                {draft.heroTitle}
              </h2>
              <p className="mt-2 text-xs text-neutral-400 max-w-lg mx-auto">
                {draft.heroSubtitle}
              </p>
              <div className="mt-4">
                <button className="px-5 py-2.5 rounded-xl bg-[var(--gold-primary)] text-black text-xs font-extrabold hover:bg-[var(--gold-hover)] shadow-lg shadow-[var(--gold-primary)]/20">
                  {draft.ctaButtonText}
                </button>
              </div>
              <p className="mt-2 text-[10px] text-neutral-500">{draft.highlightPhrase}</p>
            </div>

            {/* Plans Showcase in Preview */}
            <div className="py-6 border-b border-neutral-800">
              <div className="text-center mb-4">
                <span className="text-[10px] uppercase font-bold text-neutral-400">Planes Flexibles</span>
                <h3 className="text-sm font-bold text-white">Diseñado para tu modelo de negocio</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {state.plans.slice(0, 2).map(plan => (
                  <div key={plan.id} className="p-3.5 rounded-xl bg-[#141414] border border-neutral-800">
                    <span className="text-xs font-bold text-white block">{plan.name}</span>
                    <div className="text-base font-bold font-mono text-[var(--gold-primary)] mt-1">
                      {formatCurrency(plan.monthlyPrice, currency)} <span className="text-[10px] text-neutral-400 font-sans">/ mes</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-[11px] text-neutral-300">
                      {plan.features.slice(0, 3).map((f, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <Check className="w-3 h-3 text-[var(--gold-primary)]" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQs in Preview */}
            <div className="py-6">
              <div className="text-center mb-4">
                <HelpCircle className="w-5 h-5 text-[var(--gold-primary)] mx-auto mb-1" />
                <h3 className="text-sm font-bold text-white">Preguntas Frecuentes</h3>
              </div>
              <div className="space-y-2">
                {draft.faqs.map((faq, i) => (
                  <div key={i} className="p-3 rounded-xl bg-[#141414] border border-neutral-800 text-left">
                    <h4 className="text-xs font-bold text-white">{faq.question}</h4>
                    <p className="text-[11px] text-neutral-400 mt-1">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
