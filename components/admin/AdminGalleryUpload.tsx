/**
 * AdminGalleryUpload — multi-image uploader for admin forms.
 *
 * Mirrors the UX of AdminImageUpload but manages an ordered list of URLs.
 * Admins can:
 *   - Pick multiple files at once (uploaded in one batch via uploadsApi.multiple)
 *   - Drag & drop files onto the dropzone
 *   - Optionally paste a URL (when allowUrl=true)
 *   - Remove an image
 *   - Reorder by clicking the chevrons (◀ ▶) on a thumbnail
 *
 * The component is fully controlled — pass `value` (string[]) and listen on
 * `onChange`. It never owns the gallery state itself, so the parent form
 * stays the single source of truth.
 */
import React, { useRef, useState, useCallback } from 'react';
import {
  ImagePlus,
  Loader2,
  X,
  Link as LinkIcon,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
} from 'lucide-react';
import { uploadsApi } from '../../services/uploadsApi';
import { useToast } from '../../context/ToastContext';

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  /** Hard cap to stay within the backend's batch limit (10). */
  maxFiles?: number;
  /** Show the "paste a URL" fallback. Defaults to true. */
  allowUrl?: boolean;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file (matches single uploader)

export const AdminGalleryUpload: React.FC<Props> = ({
  value,
  onChange,
  label = 'Galerie',
  maxFiles = 10,
  allowUrl = true,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const { addToast } = useToast();

  const remaining = Math.max(0, maxFiles - value.length);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      // Drop anything over the per-form cap so we never send a request that
      // the backend will reject mid-batch.
      const accepted = files.slice(0, remaining);
      if (accepted.length < files.length) {
        addToast(`Limite atteinte : seuls ${remaining} fichier(s) ajouté(s)`, 'info');
      }
      // Validate sizes up front — fail fast and tell the admin which file.
      const tooBig = accepted.find((f) => f.size > MAX_BYTES);
      if (tooBig) {
        addToast(`"${tooBig.name}" dépasse 10 Mo`, 'error');
        return;
      }
      setBusy(true);
      try {
        // Use the batch endpoint when 2+ files, else the single endpoint
        // (slightly cheaper round-trip on the server).
        if (accepted.length === 1) {
          const res = await uploadsApi.single(accepted[0]);
          onChange([...value, res.url]);
        } else {
          const res = await uploadsApi.multiple(accepted);
          onChange([...value, ...res.urls]);
        }
        addToast(`${accepted.length} image(s) ajoutée(s)`, 'success');
      } catch (e: any) {
        addToast(e?.message || 'Échec de l\'upload', 'error');
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [remaining, value, onChange, addToast],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []).filter((f) =>
      f.type.startsWith('image/'),
    );
    if (!files.length) {
      addToast('Glissez uniquement des images', 'error');
      return;
    }
    uploadFiles(files);
  };

  const removeAt = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const moveBy = (idx: number, delta: number) => {
    const target = idx + delta;
    if (target < 0 || target >= value.length) return;
    const next = value.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const addUrl = () => {
    const u = urlDraft.trim();
    if (!u) return;
    if (value.includes(u)) {
      addToast('Cette URL est déjà dans la galerie', 'info');
      return;
    }
    if (value.length >= maxFiles) {
      addToast(`Maximum ${maxFiles} images`, 'error');
      return;
    }
    onChange([...value, u]);
    setUrlDraft('');
  };

  const full = value.length >= maxFiles;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-700">{label}</label>
        <span className="text-[10px] text-slate-400 font-bold">
          {value.length} / {maxFiles}
        </span>
      </div>

      {/* Dropzone — also serves as the file picker trigger. */}
      <button
        type="button"
        onClick={() => !full && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!full) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        disabled={busy || full}
        className={`w-full rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-1 py-6 px-3 text-center
          ${dragOver ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-300 text-slate-500 hover:border-primary-400 hover:text-primary-600'}
          ${full ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {busy ? (
          <>
            <Loader2 size={22} className="animate-spin" />
            <span className="text-[11px] font-bold">Upload en cours…</span>
          </>
        ) : (
          <>
            <UploadCloud size={22} />
            <span className="text-[11px] font-bold">
              {full ? 'Galerie pleine' : 'Glissez-déposez vos images ou cliquez ici'}
            </span>
            <span className="text-[10px] text-slate-400">
              JPG / PNG / WEBP — max 10 Mo / image — jusqu'à {maxFiles} au total
            </span>
          </>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) uploadFiles(files);
        }}
      />

      {/* Thumbnails grid — drag handles via chevron buttons (more reliable
          than HTML5 drag on touch + admin tables). */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 pt-1">
          {value.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
            >
              <img
                src={url}
                alt={`Image ${idx + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }}
              />
              {/* Index badge — first image is the gallery default. */}
              <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-black">
                {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Retirer l'image"
              >
                <X size={11} />
              </button>
              <div className="absolute bottom-1 inset-x-1 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => moveBy(idx, -1)}
                  disabled={idx === 0}
                  className="p-1 rounded-full bg-black/60 text-white disabled:opacity-30"
                  aria-label="Déplacer à gauche"
                >
                  <ChevronLeft size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => moveBy(idx, 1)}
                  disabled={idx === value.length - 1}
                  className="p-1 rounded-full bg-black/60 text-white disabled:opacity-30"
                  aria-label="Déplacer à droite"
                >
                  <ChevronRight size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {allowUrl && (
        <div className="flex items-center gap-1.5 pt-1">
          <LinkIcon size={12} className="text-slate-400 shrink-0" />
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
            placeholder="…ou coller une URL d'image"
            className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs"
            disabled={full}
          />
          <button
            type="button"
            onClick={addUrl}
            disabled={!urlDraft.trim() || full}
            className="px-2 py-1 rounded bg-slate-900 text-white text-[11px] font-bold disabled:opacity-40"
          >
            Ajouter
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminGalleryUpload;
