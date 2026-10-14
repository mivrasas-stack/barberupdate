import { backendRequest } from './liveBackend';

export type ImageKind = 'logo' | 'cover' | 'portfolio' | 'service' | 'product' | 'avatar';

export interface SignedUploadResponse {
  bucket: string;
  path: string;
  signedUrl: string;
  token: string;
}

export interface UploadOptions {
  tenantId?: string;
  kind: ImageKind;
  maxSizeBytes?: number; // default 10MB
  maxWidth?: number;     // e.g. 1920
  maxHeight?: number;    // e.g. 1920
  quality?: number;      // e.g. 0.85
  preferWebP?: boolean;  // default true
}

/**
 * Validates real magic numbers (file signature) of the buffer to prevent MIME spoofing.
 */
export async function validateImageMagicBytes(file: File): Promise<'image/jpeg' | 'image/png' | 'image/webp'> {
  const buffer = await file.slice(0, 16).arrayBuffer();
  const arr = new Uint8Array(buffer);

  // JPEG: FF D8 FF
  if (arr[0] === 0xff && arr[1] === 0xd8 && arr[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    arr[0] === 0x89 &&
    arr[1] === 0x50 &&
    arr[2] === 0x4e &&
    arr[3] === 0x47 &&
    arr[4] === 0x0d &&
    arr[5] === 0x0a &&
    arr[6] === 0x1a &&
    arr[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF ... WEBP (52 49 46 46 .... 57 45 42 50)
  if (
    arr[0] === 0x52 &&
    arr[1] === 0x49 &&
    arr[2] === 0x46 &&
    arr[3] === 0x46 &&
    arr[8] === 0x57 &&
    arr[9] === 0x45 &&
    arr[10] === 0x42 &&
    arr[11] === 0x50
  ) {
    return 'image/webp';
  }

  throw new Error('Formato no admitido. Selecciona un archivo JPEG, PNG o WebP auténtico.');
}

/**
 * Compresses and resizes an image client-side via Canvas, preferring WebP if supported.
 */
export async function compressAndProcessImage(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number; preferWebP?: boolean } = {}
): Promise<{ blob: Blob; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }> {
  const maxWidth = options.maxWidth || 1920;
  const maxHeight = options.maxHeight || 1920;
  const quality = options.quality ?? 0.85;
  const preferWebP = options.preferWebP !== false;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let width = img.naturalWidth;
      let height = img.naturalHeight;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          maxHeight;
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo inicializar el procesador de imágenes.'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const targetFormat = preferWebP ? 'image/webp' : file.type === 'image/png' ? 'image/png' : 'image/jpeg';

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Error al procesar la imagen seleccionada.'));
            return;
          }
          resolve({
            blob,
            mimeType: (blob.type as 'image/jpeg' | 'image/png' | 'image/webp') || targetFormat,
          });
        },
        targetFormat,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('El archivo seleccionado está dañado o no es una imagen válida.'));
    };

    img.src = url;
  });
}

/**
 * Uploads an image using the secure signed URL protocol to Supabase Storage.
 */
export async function uploadImageToStorage(
  file: File,
  options: UploadOptions
): Promise<string> {
  const maxBytes = options.maxSizeBytes || 10 * 1024 * 1024; // 10MB
  if (file.size > maxBytes) {
    throw new Error(`La imagen supera el límite permitido de ${(maxBytes / (1024 * 1024)).toFixed(0)} MB.`);
  }

  // 1. Verify true magic bytes
  await validateImageMagicBytes(file);

  // 2. Compress and optimize
  const { blob, mimeType } = await compressAndProcessImage(file, {
    maxWidth: options.maxWidth || 1600,
    maxHeight: options.maxHeight || 1600,
    quality: options.quality ?? 0.85,
    preferWebP: options.preferWebP !== false,
  });

  // 3. Request signed upload URL from backend
  const endpoint = options.tenantId
    ? `/tenants/${encodeURIComponent(options.tenantId)}/media/signed-upload`
    : '/me/avatar/signed-upload';

  const payload = options.tenantId
    ? { mimeType, kind: options.kind }
    : { mimeType };

  const signed = await backendRequest<SignedUploadResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  // 4. Perform upload using signed URL
  const uploadResponse = await fetch(signed.signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'x-upsert': 'false',
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text().catch(() => '');
    throw new Error(`No se pudo subir la imagen a Supabase Storage (${uploadResponse.status}): ${errorText}`);
  }

  // 5. Construct public URL using Supabase public storage endpoint
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${signed.bucket}/${signed.path}`;

  return publicUrl;
}
