/**
 * Brand list (/fiches-techniques): what the « Trier » control shows, and the
 * importer filter. Pure functions, used by TechSpecsBrands.tsx.
 */
export type BrandView = 'all' | 'popular' | 'tunisia';

export const BRAND_VIEWS: { value: BrandView; label: string }[] = [
  { value: 'all', label: 'Toutes les marques' },
  { value: 'popular', label: 'Les plus consultées' },
  { value: 'tunisia', label: 'Disponibles en Tunisie' },
];

export const ALL_IMPORTERS = 'Tout';

const key = (s: string) => s.trim().toLowerCase();

/** Unique brands (« SYM » and « Sym » are one), « Autre » left out. */
export function uniqueBrands(brands: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of brands) {
    if (!b || b === 'Autre' || seen.has(key(b))) continue;
    seen.add(key(b));
    out.push(b);
  }
  return out;
}

/**
 * A → Z, or by visits for 'popular' (the /brands/popular order, which may
 * repeat a brand in other cases: the first one counts). Brands nobody has
 * visited yet come last, A → Z.
 */
export function orderBrands(brands: string[], view: BrandView, popular: string[] = []): string[] {
  const az = [...brands].sort((a, b) => a.localeCompare(b, 'fr'));
  if (view !== 'popular') return az;
  const rank = new Map<string, number>();
  popular.forEach((b, i) => { if (!rank.has(key(b))) rank.set(key(b), i); });
  const r = (b: string) => rank.get(key(b)) ?? Number.POSITIVE_INFINITY;
  return az.sort((a, b) => r(a) - r(b));
}

export interface ImporterLike { name?: string; brands?: string[] }

/** Does this importer bring this brand in? */
export const importsBrand = (imp: ImporterLike | undefined, brand: string) =>
  !!imp?.brands?.some((b) => key(b) === key(brand));

/**
 * The importers that bring in at least one of the brands shown, each with
 * how many: an importer with nothing to show is not offered.
 */
export function importerOptions(importers: ImporterLike[], brands: string[]): { value: string; count: number }[] {
  return importers
    .filter((i): i is Required<Pick<ImporterLike, 'name'>> & ImporterLike => !!i?.name)
    .map((i) => ({ value: i.name!, count: brands.filter((b) => importsBrand(i, b)).length }))
    .filter((o) => o.count > 0)
    .sort((a, b) => a.value.localeCompare(b.value, 'fr'));
}
