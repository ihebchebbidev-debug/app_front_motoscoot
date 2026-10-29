/**
 * Persistent "back context" for the search results page.
 *
 * Goal: when the user is on /annonces?...&page=100, opens a listing, then
 * comes back, restore the EXACT same URL — filters and page number — even if
 * the browser's history was lost (hard refresh, opened listing in same tab
 * via deep link, etc.).
 *
 * We store the last URL the user actually viewed on /annonces in
 * sessionStorage so it survives in-tab navigation but doesn't leak across
 * tabs/sessions. The NavigationContext.goBack reads this when leaving a
 * detail page; SearchResults reads it on mount as a last-resort restore.
 */

const KEY = 'motoscoot.searchBackContext';
const MAX_AGE_MS = 30 * 60 * 1000; // 30 min — stale contexts are dropped.

export interface SearchBackContext {
  /** Full URL incl. query string, e.g. "/annonces?brand=Yamaha&page=100". */
  url: string;
  /** Epoch ms when the context was saved. Used to drop stale entries. */
  ts: number;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveSearchBackContext(url: string): void {
  const storage = safeStorage();
  if (!storage || !url) return;
  try {
    const payload: SearchBackContext = { url, ts: Date.now() };
    storage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* quota/serialization errors are non-fatal */
  }
}

export function readSearchBackContext(): SearchBackContext | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SearchBackContext;
    if (!parsed?.url || typeof parsed.ts !== 'number') return null;
    if (Date.now() - parsed.ts > MAX_AGE_MS) {
      storage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSearchBackContext(): void {
  const storage = safeStorage();
  if (!storage) return;
  try { storage.removeItem(KEY); } catch { /* ignore */ }
}
