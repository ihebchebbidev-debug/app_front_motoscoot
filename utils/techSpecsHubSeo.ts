/**
 * Title, description, H1 and one-line summary of the /fiches-techniques hub,
 * shared by the React page and the HTML Google receives so both say the same
 * thing (SEO audit of 2026-11-19, P1).
 *
 * The page aims at « moto prix tunisie » (320/month, KD 4) and « fiche
 * technique moto »: people search the price first, as on the brand pages
 * (« Prix SYM en Tunisie », utils/techSpecBrandHeading.ts). Counts come from
 * /api/tech-specs/brands, never typed by hand, so they stay true when the
 * catalogue changes. Every brand named in the description exists in it.
 */

import { priceValue } from './techSpecSort.js';

export interface HubBrandRow { brand: string; modelsCount?: number | null }

const NBSP = String.fromCharCode(0xa0);
const MAX_DESCRIPTION = 160;

/** Brands named in the description, most searched first, when the catalogue has them. */
const FEATURED_BRANDS = ['SYM', 'Peugeot', 'Yamaha', 'Vespa', 'Zontes', 'Piaggio', 'Kymco'];

export const HUB_H1 = 'Prix des motos et scooters en Tunisie';

/** <title> without the « | Moto-Scoot.tn » suffix (the SEO component adds it). */
export const hubPageTitle = (now: Date = new Date()) =>
  `Prix des motos et scooters en Tunisie ${now.getFullYear()} : fiches techniques`;

/** Real brands only (« Autre » and empty names are not brands). */
const realBrands = (rows: HubBrandRow[]) => {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const name = (r.brand || '').trim();
    const key = name.toLowerCase();
    if (!name || key === 'autre' || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const modelTotal = (rows: HubBrandRow[]) => {
  const counts = rows.map((r) => r.modelsCount);
  if (!counts.length || counts.some((c) => typeof c !== 'number' || !Number.isFinite(c))) return null;
  return (counts as number[]).reduce((a, b) => a + b, 0);
};

/** « 23 marques », « 101 modèles » (the second left out when a count is missing). */
export function hubSummaryParts(rows: HubBrandRow[]): string[] {
  const brands = realBrands(rows);
  if (!brands.length) return [];
  const parts = [`${brands.length}${NBSP}marque${brands.length > 1 ? 's' : ''}`];
  const models = modelTotal(brands);
  if (models) parts.push(`${models}${NBSP}modèle${models > 1 ? 's' : ''}`);
  return parts;
}

/**
 * At most 160 characters (what Google shows and what the SEO component
 * keeps): featured brands are dropped from the end until it fits. Without
 * the catalogue (API down), a sentence with no number and no brand.
 */
export function hubDescription(rows: HubBrandRow[] | null | undefined): string {
  const brands = realBrands(rows || []);
  const models = modelTotal(brands);
  const what = models
    ? `Prix du neuf et fiches techniques de ${models} motos et scooters de ${brands.length} marques en Tunisie : cylindrée, puissance, consommation.`
    : 'Prix du neuf et fiches techniques des motos et scooters vendus en Tunisie : cylindrée, puissance, couple, poids, consommation.';
  if (!brands.length) return what;
  const present = new Set(brands.map((b) => b.brand.trim().toLowerCase()));
  const named = FEATURED_BRANDS.filter((b) => present.has(b.toLowerCase()));
  for (let n = named.length; n > 0; n--) {
    const text = `${what} ${named.slice(0, n).join(', ')}…`;
    if (text.length <= MAX_DESCRIPTION) return text;
  }
  return what.length <= MAX_DESCRIPTION ? what : `${what.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// « Modèles populaires » (SEO audit of 2026-11-19, P3): fiche pages linked
// from the hub, since the fiches are the pages that rank (Jet 14, Pulsion 125,
// Liberty S). The site counts visits per brand, not per model, so the row
// takes one model per brand, in the order of /api/tech-specs/popular (most
// visited brands first, newest model first): 12 brands, not 9 SYM.

export const HUB_MODELS_HEADING = 'Modèles populaires';
export const HUB_MODELS_SUBTITLE = 'Un modèle par marque, des marques les plus consultées aux suivantes.';
export const HUB_MODELS_MAX = 12;

export interface HubModelSource { brand?: string | null; image?: string | null; price?: string | number | null }

/**
 * One model per brand, keeping the given order (most visited brands first).
 * Within a brand: the first with a photo and a price in DT, else the first
 * with a photo. A model without a photo is never picked (the card needs one).
 */
export function pickHubModels<T>(specs: T[], source: (s: T) => HubModelSource, max = HUB_MODELS_MAX): T[] {
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
