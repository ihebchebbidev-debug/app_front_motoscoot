import type { TechSpec } from '../types';

/**
 * Sorting of a brand's models on /fiches-techniques/<marque>.
 * Values come from free-text fields (« 9 000 DT », « En arrivage »,
 * « 124.6 CC », « 9.3 kW (12.6 ch) à 8000 tr/min »): they are read as
 * numbers here, and a model without a readable value always goes last.
 */
export type TechSpecSort = 'recent' | 'price-asc' | 'price-desc' | 'cc-asc' | 'power-desc';

export const TECH_SPEC_SORTS: { value: TechSpecSort; label: string }[] = [
  { value: 'recent', label: 'Plus récentes' },
  { value: 'price-asc', label: 'Prix croissant' },
  { value: 'price-desc', label: 'Prix décroissant' },
  { value: 'cc-asc', label: 'Cylindrée croissante' },
  { value: 'power-desc', label: 'Plus puissantes' },
];

const num = (s: string) => parseFloat(s.replace(',', '.'));

/** « 9 000 DT » → 9000 ; « À partir de 35 000 DT » → 35000 ; « En arrivage » → null. */
export function priceValue(priceNew?: string): number | null {
  if (!priceNew) return null;
  const compact = priceNew.replace(/[\s  ]/g, '');
  const m = compact.match(/(\d+(?:[.,]\d+)?)DT/i) || compact.match(/^(\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  const n = num(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** « 124.6 CC », « 399 cm³ » → 124.6, 399. */
export function ccValue(cc?: string): number | null {
  const m = (cc || '').match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = num(m[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Power in ch: « 12.6 ch », « 9.3 kW (12.6 ch) à 8000 tr/min » → 12.6 ; « 6.5 kW » → 8.8. */
export function powerValue(power?: string): number | null {
  const s = power || '';
  const ch = s.match(/(\d+(?:[.,]\d+)?)\s*(?:ch|cv|hp)\b/i);
  if (ch) return num(ch[1]);
  const kw = s.match(/(\d+(?:[.,]\d+)?)\s*kw\b/i);
  if (kw) return Math.round(num(kw[1]) * 1.3596 * 10) / 10;
  return null;
}

/** Ascending or descending on a value that may be missing: missing values go last either way. */
const byValue = (get: (m: TechSpec) => number | null, dir: 1 | -1) => (a: TechSpec, b: TechSpec) => {
  const va = get(a);
  const vb = get(b);
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  return (va - vb) * dir;
};

/** A new, sorted array (stable: equal models keep the catalogue order). */
export function sortTechSpecs(models: TechSpec[], sort: TechSpecSort): TechSpec[] {
  const list = [...models];
  switch (sort) {
    case 'price-asc': return list.sort(byValue((m) => priceValue(m.priceNew), 1));
    case 'price-desc': return list.sort(byValue((m) => priceValue(m.priceNew), -1));
    case 'cc-asc': return list.sort(byValue((m) => ccValue(m.engine?.cc), 1));
    case 'power-desc': return list.sort(byValue((m) => powerValue(m.engine?.power), -1));
    case 'recent':
    default: return list.sort(byValue((m) => (Number.isFinite(m.year) ? m.year : null), -1));
  }
}
