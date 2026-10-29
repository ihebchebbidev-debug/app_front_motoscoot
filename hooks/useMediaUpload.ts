import React, { useState, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { uploadsApi } from '../services/uploadsApi';
import { UploadedMedia, MAX_IMAGES } from '../types/listing';

// Backend (Express + Multer + nginx) is hardcoded to accept up to 25 MB per
// upload. We still compress aggressively client-side to keep mobile uploads
// fast and reliable, but the hard ceiling matches the server.
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 Mo — matches backend hard cap
const _COMPRESS_THRESHOLD = 700 * 1024; // 0.7 Mo
void _COMPRESS_THRESHOLD;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * Convert HEIC/HEIF (default iPhone format) to JPEG so the backend (which only
 * accepts JPEG/PNG/WebP/GIF) can process it. Lazy-loaded — heic2any pulls in
 * libheif (~700 KB) and we don't want it on the critical path.
 */
async function convertHeicIfNeeded(file: File): Promise<File> {
  const mime = (file.type || '').toLowerCase();
  const isHeic = /heic|heif/.test(mime) || /\.hei[cf]$/i.test(file.name);
  if (!isHeic) return file;

  // heic2any ships as a UMD bundle — handle both `default` and direct fn.
  const mod: any = await import('heic2any');
  const heic2any = (mod && (mod.default || mod)) as (opts: any) => Promise<Blob | Blob[]>;
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
  const blob = Array.isArray(out) ? out[0] : out;
  const newName = file.name.replace(/\.hei[cf]$/i, '.jpg') || 'photo.jpg';
  return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
}

/**
 * Iteratively re-encode any photo to JPEG so it ends up under TARGET_BYTES
 * (default ~900 KB — safely below the production nginx 1 MB cap).
 *
 * Strategy: start at 2000 px / q=0.82, then progressively drop both quality
 * and max edge until the blob fits — or we hit the floor (640 px / q=0.45)
 * and accept whatever we get. This runs entirely on canvas, no extra deps.
 *
 * Mobile cameras commonly produce 4-8 MB JPEGs which used to hit nginx 413
 * because the previous "compress only if >4 MB then 2000 px / q=0.85" pass
 * still produced ~1.5-2.5 MB files.
 */
const TARGET_BYTES = 900 * 1024;

async function compressIfLarge(file: File): Promise<File> {
  // PNG / WebP / JPEG all go through the canvas pipeline. GIFs are passed
  // through (animation would be lost on canvas).
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return file;
  }
  if (file.size <= TARGET_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file).catch(async () => {
      // Safari fallback via <img>
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = url;
        });
        return img as unknown as ImageBitmap;
      } finally {
        URL.revokeObjectURL(url);
      }
    });

    const w = (bitmap as any).width as number;
    const h = (bitmap as any).height as number;

    // Successive (max-edge, quality) passes — each one a tighter squeeze.
    const passes: Array<{ edge: number; q: number }> = [
      { edge: 2000, q: 0.82 },
      { edge: 1800, q: 0.78 },
      { edge: 1600, q: 0.72 },
      { edge: 1400, q: 0.65 },
      { edge: 1200, q: 0.6 },
      { edge: 1000, q: 0.55 },
      { edge: 800, q: 0.5 },
      { edge: 640, q: 0.45 },
    ];

    let best: Blob | null = null;

    for (const { edge, q } of passes) {
      const scale = Math.min(1, edge / Math.max(w, h));
      const tw = Math.max(1, Math.round(w * scale));
      const th = Math.max(1, Math.round(h * scale));

      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      // White background so transparent PNGs don't go black when JPEG-encoded.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, tw, th);
      ctx.drawImage(bitmap as CanvasImageSource, 0, 0, tw, th);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', q),
      );
      if (!blob) continue;
      best = blob;
      if (blob.size <= TARGET_BYTES) break; // good enough, stop here
    }

    if (!best) return file;
    if (best.size >= file.size) return file; // no gain — keep original
    const newName = file.name.replace(/\.(png|webp|jpe?g)$/i, '.jpg') || 'photo.jpg';
    return new File([best], newName, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

/**
 * Manages the deposit-form media list:
 * - keeps a local preview (blob:) while uploading
 * - sends each file to POST /api/uploads/single
 * - replaces `url` with the persistent server URL on success
 * - keeps the original File object on the entry so retry can re-POST without
 *   asking the user to re-pick the photo.
 */
export const useMediaUpload = () => {
  const { addToast } = useToast();
  const [mediaList, setMediaList] = useState<UploadedMedia[]>([]);

  const uploadFile = useCallback(
    async (mediaId: string, file: File) => {
      try {
        const result = await uploadsApi.single(file);

        setMediaList((prev) =>
          prev.map((m) => {
            if (m.id !== mediaId) return m;
            // Revoke the blob preview now that we have a persistent URL
            if (m.url.startsWith('blob:')) {
              try {
                URL.revokeObjectURL(m.url);
              } catch {}
            }
            return { ...m, status: 'success', url: result.url };
          }),
        );
      } catch (err: any) {
        // Translate the most common low-level failures into something the user
        // can act on. The generic apiClient "Connexion impossible…" message is
        // misleading on uploads — 9 times out of 10 the photo was simply too
        // big for the upstream nginx (1 MB cap) and the connection got reset
        // mid-stream, which fetch() reports as a network error.
        const status = err?.status;
        let message = err?.message || "Échec de l'envoi";
        if (status === 413) {
          message = 'Photo trop volumineuse pour le serveur (max 25 Mo). Réessayez avec une photo plus légère.';
        } else if (status === 0 || /connexion impossible|network/i.test(message)) {
          message = 'Envoi interrompu. Vérifiez votre réseau et réessayez.';
        } else if (status === 401) {
          message = 'Session expirée. Reconnectez-vous pour envoyer la photo.';
        }
        setMediaList((prev) =>
          prev.map((m) => (m.id === mediaId ? { ...m, status: 'error', error: message } : m)),
        );
        addToast(message, 'error');
      }
    },
    [addToast],
  );

  const handleImageChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) {
        e.target.value = '';
        return;
      }
      const selectedFiles = Array.from(e.target.files) as File[];
      const inputEl = e.target;
      const currentCount = mediaList.length;

      const availableSlots = MAX_IMAGES - currentCount;
      if (availableSlots <= 0) {
        addToast(`Limite de ${MAX_IMAGES} photos atteinte.`, 'warning');
        inputEl.value = '';
        return;
      }

      let filesToProcess = selectedFiles;
      if (selectedFiles.length > availableSlots) {
        addToast(`Seulement les ${availableSlots} premières photos ont été ajoutées.`, 'info');
        filesToProcess = selectedFiles.slice(0, availableSlots);
      }

      // Step 1 — quick acceptance check by extension/mime. We accept HEIC here
      // because we'll convert it client-side below. Anything truly unknown
      // (e.g. PDF, video) is dropped.
      const accepted: File[] = [];
      let unsupportedCount = 0;

      filesToProcess.forEach((file) => {
        const mime = (file.type || '').toLowerCase();
        const isHeic = /heic|heif/.test(mime) || /\.hei[cf]$/i.test(file.name);
        const isImageByName = /\.(jpe?g|png|webp|gif|hei[cf])$/i.test(file.name);
        // Some Android browsers send empty mime ("") — trust the extension.
        if (isHeic || ALLOWED_MIME.has(mime) || (!mime && isImageByName)) {
          accepted.push(file);
        } else {
          unsupportedCount++;
        }
      });

      if (unsupportedCount > 0) {
        addToast(
          `${unsupportedCount} fichier(s) ignoré(s) — format non supporté.`,
          'warning',
          6000,
        );
      }

      if (accepted.length === 0) {
        inputEl.value = '';
        return;
      }

      // Step 2 — show optimistic previews immediately so the user gets feedback
      // even while we convert/compress in the background.
      const pending = accepted.map((file) => ({
        id: Math.random().toString(36).substring(2, 9),
        url: URL.createObjectURL(file),
        status: 'uploading' as const,
        file,
      }));
      setMediaList((prev) => [...prev, ...pending]);
      inputEl.value = '';

      // Step 3 — for each picked file: convert HEIC → JPEG, then compress if
      // larger than 4 MB, then POST. This runs per-file so previews fill in
      // independently and a single bad photo doesn't block the others.
      let stillOversized = 0;
      await Promise.all(
        pending.map(async (item) => {
          try {
            let file = item.file;
            file = await convertHeicIfNeeded(file);
            file = await compressIfLarge(file);

            if (file.size > MAX_FILE_SIZE) {
              stillOversized++;
              setMediaList((prev) =>
                prev.map((m) =>
                  m.id === item.id
                    ? { ...m, status: 'error', error: 'Trop volumineuse (>10 Mo)' }
                    : m,
                ),
              );
              return;
            }

            // Update the stored File so retry uses the converted/compressed one.
            setMediaList((prev) =>
              prev.map((m) => (m.id === item.id ? { ...m, file } : m)),
            );
            await uploadFile(item.id, file);
          } catch (err: any) {
            setMediaList((prev) =>
              prev.map((m) =>
                m.id === item.id
                  ? { ...m, status: 'error', error: err?.message || 'Conversion échouée' }
                  : m,
              ),
            );
          }
        }),
      );

      if (stillOversized > 0) {
        addToast(
          `${stillOversized} photo(s) trop volumineuse(s) (>10 Mo) après compression.`,
          'warning',
        );
      }
    },
    [mediaList.length, addToast, uploadFile],
  );

  const handleRemoveImage = useCallback((idx: number) => {
    setMediaList((prev) => {
      const newList = [...prev];
      const itemToRemove = newList[idx];
      if (itemToRemove && itemToRemove.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(itemToRemove.url);
        } catch {}
      }
      newList.splice(idx, 1);
      return newList;
    });
  }, []);

  /**
   * Retry a failed upload by re-POSTing the original File. We stored it on the
   * entry in handleImageChange, so this works without the user re-picking the
   * photo. Falls back to a toast if the File is missing (e.g. draft restored
   * from localStorage where File can't be serialized).
   */
  const handleRetryUpload = useCallback(
    (id: string) => {
      const target = mediaList.find((m) => m.id === id);
      const file = (target as any)?.file as File | undefined;
      if (!file) {
        addToast('Veuillez re-sélectionner cette photo pour réessayer.', 'info');
        setMediaList((prev) => prev.filter((m) => m.id !== id));
        return;
      }
      setMediaList((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: 'uploading', error: undefined } : m)),
      );
      uploadFile(id, file);
    },
    [mediaList, addToast, uploadFile],
  );

  return {
    mediaList,
    setMediaList,
    handleImageChange,
    handleRemoveImage,
    handleRetryUpload,
  };
};
