import React, { useState, useRef } from 'react';
import { UploadCloud, Link as LinkIcon, Trash2, RefreshCw, AlertCircle, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { uploadImageToStorage, ImageKind } from '../../services/imageService';

export interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  kind?: ImageKind;
  tenantId?: string;
  label?: string;
  recommendedDimensions?: string;
  maxSizeBytes?: number; // default 10MB
  aspectRatio?: 'square' | 'video' | 'banner' | 'auto';
  disabled?: boolean;
  className?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  kind = 'product',
  tenantId,
  label,
  recommendedDimensions,
  maxSizeBytes = 10 * 1024 * 1024,
  aspectRatio = 'auto',
  disabled = false,
  className = '',
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showExternalUrlInput, setShowExternalUrlInput] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const [imgLoadFailed, setImgLoadFailed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsUploading(true);
    setImgLoadFailed(false);

    try {
      const publicUrl = await uploadImageToStorage(file, {
        tenantId,
        kind,
        maxSizeBytes,
      });

      onChange(publicUrl);
      setSuccessMsg('Imagen subida y procesada correctamente');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error uploading image:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Error inesperado al subir la imagen.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleApplyExternalUrl = () => {
    if (!externalUrl.trim()) return;
    try {
      new URL(externalUrl.trim());
    } catch {
      setErrorMsg('Ingresa una URL válida (ej. https://...)');
      return;
    }
    setErrorMsg(null);
    setImgLoadFailed(false);
    onChange(externalUrl.trim());
    setSuccessMsg('URL asignada');
    setShowExternalUrlInput(false);
    setExternalUrl('');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleClear = () => {
    onChange('');
    setImgLoadFailed(false);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const ratioClass = {
    square: 'aspect-square',
    video: 'aspect-video',
    banner: 'aspect-[3/1]',
    auto: 'min-h-[140px]',
  }[aspectRatio];

  return (
    <div className={`space-y-2.5 text-xs ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-neutral-300 font-semibold">{label}</label>
          {recommendedDimensions && (
            <span className="text-[11px] text-neutral-500 font-mono">
              Recomendado: {recommendedDimensions}
            </span>
          )}
        </div>
      )}

      {/* Main Container / Preview */}
      <div className={`relative border border-[#2e2e2e] bg-[#141414] rounded-2xl overflow-hidden transition-all ${ratioClass}`}>
        {value && !imgLoadFailed ? (
          <div className="relative w-full h-full min-h-[140px] group flex items-center justify-center bg-black/40">
            <img
              src={value}
              alt="Vista previa"
              className="w-full h-full object-cover max-h-64"
              onError={() => setImgLoadFailed(true)}
            />
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
                className="px-3 py-1.5 rounded-xl bg-[var(--gold-primary)] text-black font-bold flex items-center gap-1.5 hover:bg-[var(--gold-hover)] cursor-pointer"
                title="Reemplazar imagen"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reemplazar</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled || isUploading}
                className="px-3 py-1.5 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 font-bold flex items-center gap-1.5 hover:bg-red-500/40 cursor-pointer"
                title="Eliminar imagen"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Quitar</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 flex flex-col items-center justify-center text-center space-y-3">
            {imgLoadFailed ? (
              <div className="p-3 rounded-full bg-amber-500/10 text-amber-400">
                <AlertCircle className="w-8 h-8" />
              </div>
            ) : (
              <div className="p-3 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400">
                <ImageIcon className="w-8 h-8" />
              </div>
            )}

            <div>
              <p className="font-semibold text-white">
                {imgLoadFailed ? 'No se pudo cargar la imagen previa' : 'Ninguna imagen seleccionada'}
              </p>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Formatos permitidos: JPEG, PNG o WebP (hasta 10 MB)
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
                className="px-4 py-2 rounded-xl bg-[var(--gold-primary)] text-black font-extrabold hover:bg-[var(--gold-hover)] transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Subiendo...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Subir imagen</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowExternalUrlInput(!showExternalUrlInput)}
                disabled={disabled || isUploading}
                className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Usar URL externa</span>
              </button>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-2 z-10">
            <RefreshCw className="w-6 h-6 text-[var(--gold-primary)] animate-spin" />
            <span className="text-white font-semibold">Subiendo a Supabase Storage...</span>
            <span className="text-[11px] text-neutral-400">Optimizando y firmando transferencia</span>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Secondary External URL Option */}
      {showExternalUrlInput && (
        <div className="p-3 bg-[#181818] border border-neutral-800 rounded-xl space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-neutral-300 font-semibold">Alternativa: URL externa</span>
            <button
              type="button"
              onClick={() => setShowExternalUrlInput(false)}
              className="text-[10px] text-neutral-500 hover:text-neutral-300"
            >
              Cerrar
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://ejemplo.com/foto.jpg"
              className="flex-1 bg-black/40 border border-neutral-700 rounded-lg px-3 py-1.5 text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--gold-primary)]"
            />
            <button
              type="button"
              onClick={handleApplyExternalUrl}
              className="px-3 py-1.5 rounded-lg bg-[var(--gold-primary)] text-black font-bold hover:bg-[var(--gold-hover)] cursor-pointer"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}

      {/* Feedback Messages */}
      {errorMsg && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1 text-[11px] leading-tight">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="text-[11px] font-semibold">{successMsg}</span>
        </div>
      )}
    </div>
  );
};
