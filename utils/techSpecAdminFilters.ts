/**
 * Filters, sort and page of admin › Fiches techniques.
 *
 * The state is kept for the browser session (sessionStorage), so opening a
 * fiche and coming back shows the same list. Reading or writing storage can
 * fail (private mode, blocked site data): the list then simply starts from
 * the defaults.
 */

export type SpecStatus = '' | 'published' | 'draft' | 'incomplete';
export type SpecSort = 'recent' | 'updated' | 'brand' | 'year' | 'views';

export interface SpecFilters {
  status: SpecStatus;
  search: string;
  brand: string;
  category: string;
  tunisia: '' | 'true' | 'false';
  sort: SpecSort;
  page: number;
}

export const DEFAULT_FILTERS: SpecFilters = {
  status: '', search: '', brand: '', category: '', tunisia: '', sort: 'recent', page: 1,
};

export const SORT_OPTIONS: { value: SpecSort; label: string }[] = [
  { value: 'recent', label: 'Dernier ajout' },
  { value: 'updated', label: 'Dernière modification' },
  { value: 'brand', label: 'Marque (A → Z)' },
  { value: 'year', label: 'Année (plus récente)' },
  { value: 'views', label: 'Plus consultées' },
];

export const PAGE_SIZE = 50;
const KEY = 'ms_admin_techspecs_filters';

const STATUSES: SpecStatus[] = ['', 'published', 'draft', 'incomplete'];
const SORTS = SORT_OPTIONS.map((o) => o.value);

/** Keep only known values, so an old or edited storage entry can't break the list. */
export function sanitizeFilters(raw: unknown): SpecFilters {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s = (v: unknown, max = 100) => (typeof v === 'string' ? v.slice(0, max) : '');
  const page = Number(r.page);
  return {
    status: STATUSES.includes(r.status as SpecStatus) ? (r.status as SpecStatus) : '',
    search: s(r.search),
    brand: s(r.brand),
    category: s(r.category),
    tunisia: r.tunisia === 'true' || r.tunisia === 'false' ? r.tunisia : '',
    sort: SORTS.includes(r.sort as SpecSort) ? (r.sort as SpecSort) : 'recent',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

export function loadFilters(storage?: Pick<Storage, 'getItem'> | null): SpecFilters {
  try {
    const raw = storage?.getItem(KEY);
    return raw ? sanitizeFilters(JSON.parse(raw)) : { ...DEFAULT_FILTERS };
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

export function saveFilters(f: SpecFilters, storage?: Pick<Storage, 'setItem'> | null): void {
  try { storage?.setItem(KEY, JSON.stringify(f)); } catch { /* storage unavailable */ }
}

/**
 * Change one or more filters. Any change other than the page sends the
 * admin back to page 1 (page 4 of the old result may not exist).
 */
export function updateFilters(f: SpecFilters, patch: Partial<SpecFilters>): SpecFilters {
  const onlyPage = Object.keys(patch).every((k) => k === 'page');
  return { ...f, ...patch, page: onlyPage ? (patch.page ?? f.page) : 1 };
}

/** Filters that narrow the list (sort and page are not filters). */
export function activeFilterCount(f: SpecFilters): number {
  return [f.status, f.search.trim(), f.brand, f.category, f.tunisia].filter(Boolean).length;
}

/** Query string for GET /admin/tech-specs; empty values are left out. */
export function toQuery(f: SpecFilters) {
  return {
    page: f.page,
    limit: PAGE_SIZE,
    sort: f.sort,
    status: f.status || undefined,
    search: f.search.trim() || undefined,
    brand: f.brand || undefined,
    category: f.category || undefined,
    tunisia: f.tunisia || undefined,
  } as const;
}

/** Same rule as the API (utils/techSpecAdminList.js INCOMPLETE_SQL). */
export function isIncomplete(s: { image?: string | null; engine?: { cc?: string; power?: string } | null }): boolean {
  return !s.image || !(s.engine?.cc || s.engine?.power);
}
