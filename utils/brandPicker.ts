/**
 * Brand picker of the listing form (step « Données techniques »).
 *
 * With dozens of brands a plain <select> makes the seller scroll a long list
 * (NN/g: past ~15 options, type to filter; Baymard: a field limited to the
 * list keeps clean data without the scroll). The picker shows the brands
 * most sold in the chosen category first, then every brand A → Z, and a
 * search field that forgives case, accents, spaces and hyphens.
 */

/** Lower case, no accents, no spaces / hyphens / dots: « Royal-Enfield » = « royal enfield ». */
export const brandKey = (v: string): string =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s\-_.'’]+/g, '');

/** Brands matching the query: names that start with it first, then names that contain it; A → Z inside each group. */
export function matchBrands(names: string[], query: string): string[] {
  const q = brandKey(query);
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  if (!q) return sorted;
  const starts: string[] = [];
  const contains: string[] = [];
  for (const n of sorted) {
    const k = brandKey(n);
    if (k.startsWith(q)) starts.push(n);
    else if (k.includes(q)) contains.push(n);
  }
  return [...starts, ...contains];
}

/** How many brands the « populaires » block shows (two rows of four). */
export const POPULAR_COUNT = 8;
/** Under this many brands the A → Z list is short enough on its own. */
export const POPULAR_MIN_BRANDS = 12;

/**
 * The brands with the most live listings in the category, most first
 * (ties A → Z). Brands without a listing never count as popular.
 * `counts` keys are lower case (as the listing facets return them).
 */
export function popularBrands(names: string[], counts: Map<string, number>, limit = POPULAR_COUNT): string[] {
  if (names.length < POPULAR_MIN_BRANDS) return [];
  return names
    .map((n) => ({ n, c: counts.get(n.toLowerCase()) ?? 0 }))
    .filter((b) => b.c > 0)
    .sort((a, b) => b.c - a.c || a.n.localeCompare(b.n, 'fr', { sensitivity: 'base' }))
    .slice(0, limit)
    .map((b) => b.n);
}

/** The catalogue's own spelling when the typed name is a known brand (« yamaha » → « Yamaha »). */
export function knownBrand(names: string[], typed: string): string | undefined {
  const k = brandKey(typed);
  return k ? names.find((n) => brandKey(n) === k) : undefined;
}

/** A free brand name, tidied: trimmed, single spaces, at most 40 characters. */
export const cleanBrandName = (v: string): string => v.replace(/\s+/g, ' ').trim().slice(0, 40);
