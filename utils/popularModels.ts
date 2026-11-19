import { priceValue } from './techSpecSort.js';

/**
 * « Modèles populaires » of the home page (owner, 2026-11-19: on the home
 * page, in place of the old 3-card block, not on /fiches-techniques).
 *
 * The site counts visits per brand, not per model, so the row takes one model
 * per brand, in the order of /api/tech-specs/popular (most visited brands
 * first, newest model first): 12 brands, not 9 SYM. Shared by the React row
 * and the home HTML written at build time, so both link the same fiches.
 */

export const POPULAR_MODELS_HEADING = 'Modèles populaires';
// Wording chosen by the owner (2026-11-19).
export const POPULAR_MODELS_SUBTITLE = 'Motos et scooters en Tunisie les plus consultés sur notre plateforme.';
export const POPULAR_MODELS_MAX = 12;

export interface PopularModelSource { brand?: string | null; image?: string | null; price?: string | number | null }

/**
 * One model per brand, keeping the given order (most visited brands first).
 * Within a brand: the first with a photo and a price in DT, else the first
 * with a photo. A model without a photo is never picked (the card needs one).
 */
export function pickPopularModels<T>(specs: T[], source: (s: T) => PopularModelSource, max = POPULAR_MODELS_MAX): T[] {
  const byBrand = new Map<string, T[]>();
  for (const s of specs) {
    const { brand, image } = source(s);
    const key = String(brand || '').trim().toLowerCase();
    if (!key || key === 'autre' || !String(image || '').trim()) continue;
    if (!byBrand.has(key)) byBrand.set(key, []);
    byBrand.get(key)!.push(s);
  }
  const picked: T[] = [];
  for (const models of byBrand.values()) {
    if (picked.length >= max) break;
    picked.push(models.find((m) => priceValue(String(source(m).price ?? '')) !== null) ?? models[0]);
  }
  return picked;
}
