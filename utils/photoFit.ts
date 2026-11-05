/**
 * How the 4:3 main photo of a listing or a technical sheet fills its frame
 * on desktop (components/listing/ListingGallery.tsx). A photo close to 4:3
 * (3:2 included) fills it, losing at most a thin edge; a portrait or very
 * wide photo is shown whole, so nothing important is cut off.
 */
export const FRAME_RATIO = 4 / 3;

export function photoFit(width: number, height: number, tolerance = 0.15): 'cover' | 'contain' {
  if (!width || !height) return 'cover';
  return Math.abs(width / height - FRAME_RATIO) / FRAME_RATIO <= tolerance ? 'cover' : 'contain';
}
