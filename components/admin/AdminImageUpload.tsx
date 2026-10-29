/**
 * AdminImageUpload — reusable file picker that uploads via uploadsApi
 * and exposes the resulting absolute URL through `onChange`. Used by the
 * admin Reference / Articles / Tech-specs / Garage tabs.
 *
 * UX matches the rest of the app's upload paths (listings MediaUploader,
 * profile avatar, signup logo):
 *   - Accepts JPG/PNG/WebP/SVG and HEIC (iPhone). HEIC is converted to JPEG
 *     in the browser via heic2any (lazy-loaded).
 *   - Compresses raster images client-side before upload (compressImage),
 *     same util every other upload uses. SVG is sent as-is.
 *   - Shows an INSTANT local preview (object URL) while the upload runs,
 *     then swaps to the canonical server URL on success. Lets admins judge
 *     the icon visually before the round-trip completes.
 *   - Drag-and-drop support, plus optional "paste a URL" fallback.
 *   - 10 MB hard ceiling (raw file), revoke the blob URL on unmount.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, Link as LinkIcon, UploadCloud } from 'lucide-react';
import { uploadsApi } from '../../services/uploadsApi';
import { useToast } from '../../context/ToastContext';
import { compressImage } from '../../utils/imageCompression';

interface Props {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  /** Optional: also let the admin paste a URL manually. Defaults to true. */
  allowUrl?: boolean;
}

const MAX_RAW_BYTES = 10 * 1024 * 1024; // 10 MB
const HEIC_RE = /\.(heic|heif)$/i;

export const AdminImageUpload: React.FC<Props> = ({
  value,
  onChange,
  label = 'Image',
  allowUrl = true,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Local blob URL used as an OPTIMISTIC preview while the upload runs.
  // Cleared as soon as the server returns the canonical URL (or on error).
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const { addToast } = useToast();

  // Always revoke any pending blob URL when the component unmounts so we
  // don't leak memory in long admin sessions.
  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const onFile = async (raw: File) => {
    if (!raw) return;
    if (raw.size > MAX_RAW_BYTES) {
      addToast('Fichier trop volumineux (max 10 Mo).', 'error');
      return;
    }

    // Accept any image MIME or HEIC (iOS reports HEIC with an empty type
    // sometimes — fall back to extension sniffing so we never reject a valid
    // photo that the user can clearly see in the picker).
    const isHeic = HEIC_RE.test(raw.name) || raw.type === 'image/heic' || raw.type === 'image/heif';
    if (!raw.type.startsWith('image/') && !isHeic) {
      addToast('Seules les images sont acceptées (JPG, PNG, WebP, SVG, HEIC).', 'error');
      return;
    }

    setBusy(true);
    // Show an instant preview from the raw file BEFORE the network round-trip
    // so the admin can see what they picked while compression + upload runs.
    const previewUrl = URL.createObjectURL(raw);
    setLocalPreview(previewUrl);

    try {
      let file: File = raw;

      // 1) HEIC → JPEG (lazy-loaded so we don't ship heic2any in the admin
      //    bundle for every page load).
      if (isHeic) {
        try {
          const heic2any = (await import('heic2any')).default as any;
          const converted = await heic2any({ blob: raw, toType: 'image/jpeg', quality: 0.9 });
          const blob = Array.isArray(converted) ? converted[0] : converted;
          file = new File([blob], raw.name.replace(HEIC_RE, '.jpg'), { type: 'image/jpeg' });
        } catch (err) {
          console.warn('[AdminImageUpload] HEIC conversion failed, sending raw:', err);
        }
      }

      // 2) Compress raster images. SVG is vector → skip (compressImage already
      //    no-ops on non-image MIME, but be explicit to make intent obvious).
      const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
      if (!isSvg) {
        file = await compressImage(file);
      }

      // 3) Upload via the same endpoint every other admin upload uses.
      const res = await uploadsApi.single(file);
      onChange(res.url);
      addToast('Image téléversée.', 'success');
    } catch (e: any) {
      addToast(e?.message || "Échec de l'upload.", 'error');
    } finally {
      setBusy(false);
      // Drop the local blob — the rendered <img> will switch to the canonical
      // server URL on the next render via `value`.
      URL.revokeObjectURL(previewUrl);
      setLocalPreview(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  // The preview shown to the admin: while uploading, prefer the freshly-picked
  // local file so they see their own image instantly; otherwise show the
  // canonical URL persisted on the resource.
  const previewSrc = localPreview || value || '';

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-slate-700">{label}</label>

      <div
        className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
          dragOver ? 'bg-primary-50 ring-2 ring-primary-300' : ''
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {previewSrc ? (
          <div className="relative group shrink-0">
            <img
              src={previewSrc}
              alt="Aperçu"
              className={`w-28 h-28 object-cover rounded-lg border border-slate-200 bg-slate-50 ${
                busy ? 'opacity-60' : ''
              }`}
            />
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                <Loader2 size={22} className="animate-spin text-white" />
              </div>
            )}
            {!busy && (
              <button
                type="button"
                onClick={() => {
                  if (localPreview) URL.revokeObjectURL(localPreview);
                  setLocalPreview(null);
                  onChange('');
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Retirer l'image"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="w-28 h-28 shrink-0 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-primary-400 hover:text-primary-600 disabled:opacity-50 transition-colors"
          >
            {busy ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <UploadCloud size={22} />
                <span className="text-[10px] mt-1 font-bold leading-tight text-center px-1">
                  Cliquer ou<br />glisser-déposer
                </span>
              </>
            )}
          </button>
        )}

        <div className="flex-1 space-y-2 min-w-0">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.heic,.heif,.svg"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
            {previewSrc ? 'Remplacer' : 'Téléverser'}
          </button>
          <p className="text-[10px] text-slate-400">
            JPG, PNG, WebP, SVG ou HEIC. 10 Mo max — l'image est compressée avant l'envoi.
          </p>
          {allowUrl && (
            <div className="flex items-center gap-1.5">
              <LinkIcon size={12} className="text-slate-400 shrink-0" />
              <input
                type="url"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder="…ou coller une URL"
                className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded text-xs"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminImageUpload;
