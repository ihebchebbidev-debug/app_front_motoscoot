/**
 * AdminGalleryUpload — multi-image uploader for admin forms.
 *
 * Mirrors the UX of AdminImageUpload but manages an ordered list of URLs.
 * Admins can:
 *   - Pick multiple files at once (uploaded in one batch via uploadsApi.multiple)
 *   - Drag & drop files onto the dropzone
 *   - Optionally paste a URL (when allowUrl=true)
 *   - Remove an image
 *   - Reorder by dragging the grip on a thumbnail (dnd kit: mouse, long
 *     press on a touch screen, Space + arrows on the keyboard) or with the
 *     ◀ ▶ buttons, kept as the simple accessible alternative
 *   - Optionally (`crop`) crop an image: the shared crop window, then the
 *     cropped photo is uploaded in its place
 *
 * The component is fully controlled — pass `value` (string[]) and listen on
 * `onChange`. It never owns the gallery state itself, so the parent form
 * stays the single source of truth.
 */
import React, { Suspense, lazy, useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, closestCenter, MouseSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, DragOverlay, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Loader2,
  X,
  Link as LinkIcon,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  Crop as CropIcon,
  GripVertical,
} from 'lucide-react';
import { uploadsApi } from '../../services/uploadsApi';
import { useToast } from '../../context/ToastContext';
import { compressImage } from '../../utils/imageCompression';
import {
  galleryItemIds, reorderGallery, moveGalleryItem, galleryAnnouncements, GALLERY_DND_INSTRUCTIONS,
} from '../../utils/adminGallery';

const PhotoCropDialog = lazy(() => import('../common/PhotoCropDialog'));

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  /** Hard cap to stay within the backend's batch limit (10). */
  maxFiles?: number;
  /** Show the "paste a URL" fallback. Defaults to true. */
  allowUrl?: boolean;
  /** Show a "Recadrer" button on each image. Defaults to false. */
  crop?: boolean;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file (matches single uploader)

/** True when the system asks for less motion: no slide or drop animation then. */
function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const update = () => setReduced(mq.matches);
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

interface ThumbProps {
  id: string;
  url: string;
  index: number;
  total: number;
  reducedMotion: boolean;
  cropping: boolean;
  canCrop: boolean;
  onCrop: () => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
}

/**
 * One gallery image. Only the grip (top left, with the position number) starts
 * a drag, so Supprimer, Recadrer and the arrows keep working as plain clicks
 * and a finger on the picture still scrolls the page.
 */
const SortableThumb: React.FC<ThumbProps> = ({
  id, url, index, total, reducedMotion, cropping, canCrop, onCrop, onRemove, onMove,
}) => {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging,
  } = useSortable({ id, transition: reducedMotion ? null : undefined });
  const first = index === 0;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition: transition ?? undefined }}
      className={`relative group aspect-square rounded-lg overflow-hidden bg-slate-100 ${
        isDragging
          ? 'border-2 border-dashed border-primary-500 [&>*]:opacity-30'
          : first ? 'border-2 border-primary-600' : 'border border-slate-200'
      }`}
    >
      <img
        src={url}
        alt={`Image ${index + 1}`}
        draggable={false}
        className="w-full h-full object-cover"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }}
      />
      {cropping && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 size={18} className="animate-spin text-white" />
        </div>
      )}
      {canCrop && (
        <button
          type="button"
          onClick={onCrop}
          className="absolute z-10 bottom-1 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 p-1.5 sm:px-2 sm:py-1 rounded-full bg-white text-slate-800 text-[11px] font-bold hover:bg-slate-100"
          aria-label={`Recadrer l'image ${index + 1}`}
          title="Recadrer"
        >
          {/* Icon only on a phone: the word would cover the ← → buttons. */}
          <CropIcon size={12} aria-hidden="true" /><span className="hidden sm:inline">Recadrer</span>
        </button>
      )}
      {/* Grip + position: always visible, the only place a drag starts.
          The first image (shown first) has the brand colour. */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className={`absolute top-1 left-1 inline-flex items-center gap-0.5 min-h-[28px] pl-0.5 pr-1.5 rounded-md text-white text-[10px] font-black select-none [-webkit-touch-callout:none] [touch-action:manipulation] cursor-grab active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-600 ${
          first ? 'bg-primary-600' : 'bg-black/65 hover:bg-black/80'
        }`}
        aria-label={`Déplacer l'image ${index + 1} sur ${total}${first ? ' (affichée en premier)' : ''}`}
        title="Glisser pour changer l'ordre"
      >
        <GripVertical size={14} aria-hidden="true" />
        <span aria-hidden="true">{index + 1}</span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 touch:opacity-100 transition-opacity motion-reduce:transition-none"
        aria-label={`Retirer l'image ${index + 1}`}
      >
        <X size={11} />
      </button>
      <div className="absolute bottom-1 inset-x-1 flex items-center justify-between opacity-0 group-hover:opacity-100 focus-within:opacity-100 touch:opacity-100 transition-opacity motion-reduce:transition-none">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          className="p-1.5 sm:p-1 rounded-full bg-black/60 text-white disabled:opacity-30"
          aria-label={`Déplacer l'image ${index + 1} à gauche`}
        >
          <ChevronLeft size={11} />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          className="p-1.5 sm:p-1 rounded-full bg-black/60 text-white disabled:opacity-30"
          aria-label={`Déplacer l'image ${index + 1} à droite`}
        >
          <ChevronRight size={11} />
        </button>
      </div>
    </li>
  );
};

export const AdminGalleryUpload: React.FC<Props> = ({
  value,
  onChange,
  label = 'Galerie',
  maxFiles = 10,
  allowUrl = true,
  crop = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [cropIdx, setCropIdx] = useState<number | null>(null);
  const [croppingUrl, setCroppingUrl] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [moveMessage, setMoveMessage] = useState('');
  const reducedMotion = usePrefersReducedMotion();
  const { addToast } = useToast();
  // The upload of a cropped image ends after a re-render: read the gallery as it is then.
  const valueRef = useRef(value);
  valueRef.current = value;

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

  const moveBy = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= value.length) return;
    onChange(moveGalleryItem(value, idx, delta));
    setMoveMessage(`Image ${idx + 1} déplacée en position ${target + 1} sur ${value.length}.`);
  };

  // Drag and drop: stable ids so React keeps each tile while it moves.
  const ids = galleryItemIds(value);
  const activeIndex = activeId ? ids.indexOf(activeId) : -1;
  const sensors = useSensors(
    // Mouse: a 6 px move starts a drag, so a plain click still clicks.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Finger: a short press on the grip, so swiping still scrolls the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const announcements = galleryAnnouncements(() => valueRef.current);
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const next = reorderGallery(value, String(active.id), over ? String(over.id) : null);
    if (next.some((u, i) => u !== value[i])) onChange(next);
  };

  // Cropped image replaces the one it came from, wherever it now sits.
  const onCropped = async (sourceUrl: string, cropped: File) => {
    setCropIdx(null);
    setCroppingUrl(sourceUrl);
    try {
      const res = await uploadsApi.single(await compressImage(cropped));
      const list = valueRef.current;
      const at = list.indexOf(sourceUrl);
      if (at >= 0) onChange(list.map((u, i) => (i === at ? res.url : u)));
      addToast('Image recadrée', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Échec de l\'upload', 'error');
    } finally {
      setCroppingUrl(null);
    }
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
      {value.length > 1 && (
        <p className="text-[11px] text-slate-500">
          Pour changer l'ordre, faites glisser la poignée <GripVertical size={11} className="inline -mt-0.5" aria-hidden="true" /> d'une image
          (appui court sur téléphone) ou utilisez les flèches. L'image 1 s'affiche en premier.
        </p>
      )}

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

      {/* Thumbnails — drag the grip (mouse, long press on a phone, Space +
          arrows on the keyboard) or use the ← → buttons to reorder. */}
      {value.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
          accessibility={{
            screenReaderInstructions: { draggable: GALLERY_DND_INSTRUCTIONS },
            announcements,
          }}
        >
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-3 md:grid-cols-5 gap-2 pt-1" aria-label={`${label || 'Galerie'} : ordre des images`}>
              {value.map((url, idx) => (
                <SortableThumb
                  key={ids[idx]}
                  id={ids[idx]}
                  url={url}
                  index={idx}
                  total={value.length}
                  reducedMotion={reducedMotion}
                  cropping={croppingUrl === url}
                  canCrop={crop && croppingUrl !== url && !/\.svg(\?|$)/i.test(url)}
                  onCrop={() => setCropIdx(idx)}
                  onRemove={() => removeAt(idx)}
                  onMove={(delta) => moveBy(idx, delta)}
                />
              ))}
            </ul>
          </SortableContext>
          {createPortal(
            <DragOverlay zIndex={1000} dropAnimation={reducedMotion ? null : undefined}>
              {activeIndex >= 0 ? (
                <div
                  className={`relative aspect-square w-full rounded-lg overflow-hidden border-2 border-primary-600 bg-slate-100 shadow-2xl cursor-grabbing ${
                    reducedMotion ? '' : 'scale-105 rotate-2'
                  }`}
                >
                  <img src={value[activeIndex]} alt="" className="w-full h-full object-cover" draggable={false} />
                  <span className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-white text-[10px] font-black ${activeIndex === 0 ? 'bg-primary-600' : 'bg-black/70'}`}>
                    {activeIndex + 1}
                  </span>
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      )}
      {/* Result of the ← → buttons, read out by screen readers. */}
      <p className="sr-only" aria-live="polite">{moveMessage}</p>

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
      {cropIdx !== null && value[cropIdx] && (
        <Suspense fallback={null}>
          <PhotoCropDialog
            source={value[cropIdx]}
            onCancel={() => setCropIdx(null)}
            onConfirm={(file) => onCropped(value[cropIdx], file)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default AdminGalleryUpload;
