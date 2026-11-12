/**
 * A page's code (/assets/<Page>-<hash>.js) failed to load. Two real causes:
 *  - the tab was opened before a deploy: its old app asks for an old file
 *    that the new deploy no longer serves (404);
 *  - the browser kept a 404 for a new file requested in the instant a deploy
 *    switched over (/assets/* is cached « immutable », see assetRetry.ts).
 * The global ErrorBoundary used to send the visitor to the home page
 * (2026-11-07: tapping a brand on a phone opened the home page). Instead:
 * fetch the file again from the network (replaces a cached 404), then reload
 * the page that was asked for, which gets the current app. At most once every
 * 5 minutes: on 2026-11-12 an iPhone (Safari) kept a cached 404 that the
 * repair fetch did not replace, and the old 10 s limit only spaced the reloads
 * out (a white page reloading forever). After the one reload, the old
 * behaviour runs.
 */

// Chrome, Safari, Firefox wordings, Vite's CSS preload, older bundlers.
const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading (?:CSS )?chunk [\w-]+ failed/i;

const messageOf = (error: unknown) =>
  String((error as { message?: unknown } | null)?.message ?? error ?? '');

export const isChunkLoadError = (error: unknown) => CHUNK_ERROR.test(messageOf(error));

/** The file named in the error, when the browser gives it (Chrome, Firefox, Vite CSS). */
export function failedAssetUrl(error: unknown): string | null {
  const m = messageOf(error).match(/(?:https?:\/\/[^\s'"]+)?\/assets\/[^\s'")]+\.(?:js|css)/);
  return m ? m[0] : null;
}

const KEY = 'chunk-retry-reload';
const WINDOW_MS = 5 * 60_000;

/** Whether a reload may run now (none in the last 5 minutes). */
export const mayReload = (now: number, last: number) => !(last && now - last < WINDOW_MS);

/**
 * Repairs the cache and reloads the current page. Returns false (and does
 * nothing) when it already did so in the last 5 minutes or storage is blocked.
 */
export function reloadForCurrentVersion(error: unknown): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const now = Date.now();
    if (!mayReload(now, Number(sessionStorage.getItem(KEY)) || 0)) return false;
    sessionStorage.setItem(KEY, String(now));
  } catch {
    return false;
  }
  const url = failedAssetUrl(error);
  const repair = url ? fetch(url, { cache: 'reload' }).catch(() => undefined) : Promise.resolve(undefined);
  repair.finally(() => window.location.reload());
  return true;
}
