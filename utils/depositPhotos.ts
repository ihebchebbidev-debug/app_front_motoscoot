/**
 * Photo order and crop rules of the "Déposer une annonce" gallery
 * (components/deposit/MediaUploader.tsx). The first photo is the listing's
 * main photo ("Principale"), so changing the order changes the cover.
 */

/** Moves the photo at `from` to `to`; out-of-range indexes leave the list as is. */
export function movePhoto<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [picked] = next.splice(from, 1);
  next.splice(to, 0, picked);
  return next;
}

/** Makes the photo at `index` the main photo (first), keeping the others in order. */
export function makeMainPhoto<T>(list: readonly T[], index: number): T[] {
  return movePhoto(list, index, 0);
}

/** Crop frames offered to the seller; 4:3 is the listing-card format. */
export const CROP_RATIOS = [
  { id: '4:3', label: '4:3', value: 4 / 3 },
  { id: '1:1', label: 'Carré', value: 1 },
  { id: '16:9', label: '16:9', value: 16 / 9 },
  { id: 'original', label: 'Originale', value: null },
] as const;
export type CropRatioId = (typeof CROP_RATIOS)[number]['id'];

export interface CropArea { x: number; y: number; width: number; height: number }

/**
 * Size of the cropped photo: the selected area in real pixels, scaled down
 * so its longest side is at most `maxEdge` (the server stores 1600 px).
 */
export function cropOutputSize(area: CropArea, maxEdge = 2000): { width: number; height: number } {
  const w = Math.max(1, Math.round(area.width));
  const h = Math.max(1, Math.round(area.height));
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}
