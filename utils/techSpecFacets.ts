import type { TechSpec } from '../types';
import { ccValue } from './techSpecSort';

/**
 * Filters of /fiches-techniques/<marque>, built from the brand's own models.
 * Every option carries the number of models it would show with the other
 * filters kept, so no choice leads to « Aucun modèle » by surprise.
 * The previous lists were fixed: for SYM (scooters only), 5 types out of 6
 * and 2 cylinder bands out of 3 gave nothing.
 */
export const ALL = 'Tout';

export interface FacetState { type: string; year: string; cc: string }

const TYPE_ORDER = ['Scooter', 'Maxi-scooter', 'Roadster', 'Sportive', 'Trail', 'Custom', 'Tout-terrain'];
const TYPE_LABEL: Record<string, string> = {
  Roadster: 'Roadster', Sportive: 'Sportive', Trail: 'Trail', Scooter: 'Scooter', Custom: 'Custom', 'Off-road': 'Tout-terrain',
};
/** Cylinder bands on the licence thresholds (50 cc, 125 cc), then mid / big. */
const CC_ORDER = ['50 cc et moins', '51 à 125 cc', '126 à 500 cc', 'Plus de 500 cc'];

export function typeOf(m: TechSpec): string | null {
  const cc = ccValue(m.engine?.cc) ?? 0;
  if (m.category === 'Scooter' && cc >= 400) return 'Maxi-scooter';
  return TYPE_LABEL[m.category] ?? null;
}

export function ccBandOf(m: TechSpec): string | null {
  const cc = ccValue(m.engine?.cc);
  if (cc === null) return null;
  if (cc <= 50) return CC_ORDER[0];
  if (cc < 126) return CC_ORDER[1]; // 124.6 / 125 cc → « 51 à 125 cc »
  if (cc <= 500) return CC_ORDER[2];
  return CC_ORDER[3];
}

const yearOf = (m: TechSpec) => (m.year != null && Number.isFinite(m.year) ? String(m.year) : null);

const DIMS = {
  type: typeOf,
  year: yearOf,
  cc: ccBandOf,
} as const;
type Dim = keyof typeof DIMS;

/** Does a model pass every active filter (optionally ignoring one dimension)? */
export function matchesFacets(m: TechSpec, state: FacetState, ignore?: Dim): boolean {
  return (Object.keys(DIMS) as Dim[]).every((d) => d === ignore || state[d] === ALL || DIMS[d](m) === state[d]);
}

export interface FacetOption { value: string; count: number }

/** Options of one dimension: only values present in the brand, in a sensible order, each with its count. */
export function facetOptions(models: TechSpec[], state: FacetState, dim: Dim): FacetOption[] {
  const present = new Set(models.map(DIMS[dim]).filter((v): v is string => !!v));
  let values = [...present];
  if (dim === 'type') values = TYPE_ORDER.filter((v) => present.has(v));
  else if (dim === 'cc') values = CC_ORDER.filter((v) => present.has(v));
  else values.sort((a, b) => Number(b) - Number(a));
  const pool = models.filter((m) => matchesFacets(m, state, dim));
  return values.map((value) => ({ value, count: pool.filter((m) => DIMS[dim](m) === value).length }));
}

/** Number of filters in use (shown on the phone « Filtres » button). */
export const activeFacetCount = (state: FacetState) =>
  (Object.keys(DIMS) as Dim[]).filter((d) => state[d] !== ALL).length;

/** Under this number of models, filters only get in the way: the page shows the models directly. */
export const MIN_MODELS_FOR_FILTERS = 5;
