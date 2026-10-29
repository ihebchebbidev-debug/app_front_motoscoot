/**
 * Lightweight localStorage-backed recent-searches log.
 * - Keeps the last 6 unique queries (newest first).
 * - Stores a label + the navigation params so a single click re-runs the search.
 * - Anonymous users keep their history across sessions; logged-in users get the
 *   same boost without requiring a backend round-trip.
 */
const KEY = 'motoscoot.recentSearches.v1';
const MAX = 6;

export interface RecentSearchEntry {
  label: string;
  /** Params accepted by NavigationContext.navigateTo('search', params) */
  params: Record<string, unknown>;
  ts: number;
}

function read(): RecentSearchEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(e => e && typeof e.label === 'string') : [];
  } catch { return []; }
}

function write(entries: RecentSearchEntry[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
    // Notify same-tab listeners (storage event only fires across tabs).
    window.dispatchEvent(new CustomEvent('motoscoot:recentSearchesChanged'));
  } catch { /* ignore */ }
}

export function getRecentSearches(): RecentSearchEntry[] {
  return read();
}

export function addRecentSearch(entry: Omit<RecentSearchEntry, 'ts'>) {
  if (!entry.label || !entry.label.trim()) return;
  const existing = read();
  const dedup = existing.filter(e => e.label.toLowerCase() !== entry.label.toLowerCase());
  dedup.unshift({ ...entry, ts: Date.now() });
  write(dedup);
}

export function clearRecentSearches() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent('motoscoot:recentSearchesChanged')); } catch { /* ignore */ }
}

export function removeRecentSearch(label: string) {
  const next = read().filter(e => e.label.toLowerCase() !== label.toLowerCase());
  write(next);
}

/** Track recently *viewed* listings — used by Similar Ads re-ranking. */
const VIEW_KEY = 'motoscoot.recentlyViewed.v1';
const VIEW_MAX = 20;

export interface RecentViewEntry {
  id: string | number;
  brand?: string;
  model?: string;
  type?: string;
  ts: number;
}

export function getRecentlyViewed(): RecentViewEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(VIEW_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function trackRecentlyViewed(entry: Omit<RecentViewEntry, 'ts'>) {
  if (entry.id == null) return;
  const existing = getRecentlyViewed().filter(e => String(e.id) !== String(entry.id));
  existing.unshift({ ...entry, ts: Date.now() });
  try {
    window.localStorage.setItem(VIEW_KEY, JSON.stringify(existing.slice(0, VIEW_MAX)));
  } catch { /* ignore */ }
}
