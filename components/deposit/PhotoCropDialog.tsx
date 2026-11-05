import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Cropper, { type Area, type MediaSize } from 'react-easy-crop';
import { X, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { CROP_RATIOS, type CropRatioId, cropOutputSize } from '../../utils/depositPhotos';

interface PhotoCropDialogProps {
  /** Photo to crop: the picked file when we still have it, else its URL. */
  source: File | string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Photo illisible'));
    img.src = src;
  });

async function cropToFile(src: string, area: Area): Promise<File> {
  const img = await loadImage(src);
  const { width, height } = cropOutputSize(area);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Recadrage impossible');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) throw new Error('Recadrage impossible');
  return new File([blob], 'photo-recadree.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}

/**
 * Crop window of the deposit gallery (lazy-loaded with react-easy-crop):
 * drag to frame, pinch / slider to zoom, 4:3 by default (listing-card format).
 */
const PhotoCropDialog: React.FC<PhotoCropDialogProps> = ({ source, onCancel, onConfirm }) => {
  const [src] = useState(() => (typeof source === 'string' ? source : URL.createObjectURL(source)));
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [ratioId, setRatioId] = useState<CropRatioId>('4:3');
  const [naturalRatio, setNaturalRatio] = useState(4 / 3);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const applyRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Closes on a click that starts and ends on the backdrop, not on a crop drag released outside.
  const pressedOnBackdrop = useRef(false);

  useEffect(() => () => { if (typeof source !== 'string') URL.revokeObjectURL(src); }, [source, src]);

  // Other photos may finish uploading while the window is open: keep focus
  // and the scroll lock set once, with the latest onCancel.
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    applyRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Escape closes; Tab stays inside the window.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { cancelRef.current(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex="0"]')];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!dialogRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);

  const ratio = CROP_RATIOS.find((r) => r.id === ratioId)?.value ?? naturalRatio;

  const onMediaLoaded = useCallback((m: MediaSize) => {
    if (m.naturalWidth && m.naturalHeight) setNaturalRatio(m.naturalWidth / m.naturalHeight);
  }, []);

  const apply = async () => {
    if (!area || busy) return;
    setBusy(true);
    setError(null);
    try {
      onConfirm(await cropToFile(src, area));
    } catch {
      setError('Recadrage impossible pour cette photo. Supprimez-la et ajoutez-la de nouveau.');
      setBusy(false);
    }
  };

  // Rendered at the root of the page: the deposit step's entrance animation
  // keeps a transform, which would trap a fixed window inside the step.
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-stretch md:items-center justify-center bg-black/80 md:p-4"
      onPointerDown={(e) => { pressedOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (pressedOnBackdrop.current && e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-title"
        className="flex flex-col w-full h-full md:h-auto md:max-w-2xl bg-card md:rounded-3xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h2 id="crop-title" className="text-lg font-black text-gray-900">Recadrer la photo</h2>
          <button type="button" onClick={onCancel} className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full text-gray-600 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <div className="relative flex-1 min-h-[300px] md:flex-none md:h-[420px] bg-neutral-900">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={ratio}
            minZoom={1}
            maxZoom={4}
            objectFit="contain"
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
            onMediaLoaded={onMediaLoaded}
            mediaProps={{ crossOrigin: 'anonymous', alt: '' }}
          />
        </div>

        <div className="px-5 pt-4 pb-5 space-y-4" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Format">
            {CROP_RATIOS.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={ratioId === r.id}
                onClick={() => setRatioId(r.id)}
                className={`h-11 px-4 rounded-full text-sm font-bold border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 ${
                  ratioId === r.id
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'bg-card border-neutral-200 text-gray-700 hover:border-primary-400'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-3">
            <ZoomOut size={18} className="text-gray-400 shrink-0" aria-hidden="true" />
            <span className="sr-only">Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
            <ZoomIn size={18} className="text-gray-400 shrink-0" aria-hidden="true" />
          </label>

          {error && <p role="alert" className="text-xs font-bold text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-12 rounded-full border border-neutral-300 text-sm font-bold text-gray-800 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
            >
              Annuler
            </button>
            <button
              ref={applyRef}
              type="button"
              onClick={apply}
              disabled={!area || busy}
              className="flex-1 h-12 rounded-full bg-primary-600 text-white text-sm font-black hover:bg-primary-700 disabled:opacity-60 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              Appliquer
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PhotoCropDialog;
