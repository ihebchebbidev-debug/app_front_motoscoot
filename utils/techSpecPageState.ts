import { TECH_SPEC_SORTS, type TechSpecSort } from './techSpecSort';
import { ALL } from './techSpecFacets';

/**
 * What the visitor set on a brand page (/fiches-techniques/<marque>): sort,
 * filters and search. Kept for this tab only (sessionStorage), and given
 * back only when they come back with the browser's Back button: opening a
 * sheet and returning used to land at the top, sort back to « Plus
 * récentes », filters cleared. A new visit from a link starts fresh.
 */
export interface BrandPageState { sort: TechSpecSort; type: string; year: string; cc: string; q: string }

export const DEFAULT_BRAND_PAGE_STATE: BrandPageState = { sort: 'recent', type: ALL, year: ALL, cc: ALL, q: '' };

const key = (brandSlug: string) => `ms_fiches_marque_${brandSlug.toLowerCase()}`;
const SORTS = new Set<string>(TECH_SPEC_SORTS.map((s) => s.value));
const str = (v: unknown, max = 80) => (typeof v === 'string' && v.length <= max ? v : null);

/** A saved value, checked field by field (anything odd falls back to the default). */
export function parseBrandPageState(raw: string | null): BrandPageState | null {
  if (!raw) return null;
  let o: Record<string, unknown>;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || typeof o !== 'object') return null;
  const d = DEFAULT_BRAND_PAGE_STATE;
  return {
    sort: typeof o.sort === 'string' && SORTS.has(o.sort) ? (o.sort as TechSpecSort) : d.sort,
    type: str(o.type) ?? d.type,
    year: str(o.year) ?? d.year,
    cc: str(o.cc) ?? d.cc,
    q: str(o.q, 120) ?? d.q,
  };
}

export function readBrandPageState(brandSlug: string): BrandPageState | null {
  try { return parseBrandPageState(sessionStorage.getItem(key(brandSlug))); } catch { return null; }
}

export function saveBrandPageState(brandSlug: string, state: BrandPageState): void {
  try { sessionStorage.setItem(key(brandSlug), JSON.stringify(state)); } catch { /* private mode: nothing kept */ }
}
