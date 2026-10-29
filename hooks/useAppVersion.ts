import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * useAppVersion
 * --------------------------------------------------------------------
 * Detects when a new build of the app has been deployed (by polling a
 * static `/version.json` file that Vite generates at build-time) and
 * performs a SEAMLESS reload — but only at safe moments:
 *
 *   1. When the user navigates to a new route (route change).
 *   2. When the tab regains focus after being hidden.
 *
 * This means an active user mid-form / mid-scroll is NEVER interrupted.
 * The reload happens "between" actions, so it feels like a normal page
 * transition.
 *
 * It also recovers from chunk-load errors caused by stale references
 * to old hashed bundles after a deploy — when Vite throws
 * "Failed to fetch dynamically imported module", we hard-reload once.
 */

const VERSION_URL = '/version.json';
const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const RELOAD_FLAG = '__motoscoot_reloaded_for_update__';

/**
 * Routes where a hard reload would clobber unsaved user input. We refuse
 * to auto-reload while the user is on these pages even if a new build is
 * available — the next navigation OUT of these pages will pick it up.
 */
const FORM_HEAVY_ROUTE_RE = /^\/(deposer-une-annonce|deposer|publier|dashboard\/messages|dashboard\/parametres|dashboard\/mes-annonces|reinitialiser-mot-de-passe|inscription|connexion)/i;

/**
 * Returns true if the user has interacted (typed, clicked, scrolled) within
 * the last `withinMs`. We track this with a single capture-phase listener so
 * `safeReload` can bail when the user is mid-action even on routes we'd
 * otherwise consider safe.
 */
let lastUserInteractionTs = 0;
if (typeof window !== 'undefined') {
  const bump = () => { lastUserInteractionTs = Date.now(); };
  // Passive + capture so we never block UI.
  window.addEventListener('keydown', bump, { capture: true, passive: true });
  window.addEventListener('input', bump, { capture: true, passive: true });
  window.addEventListener('pointerdown', bump, { capture: true, passive: true });
}

function isUserActive(withinMs = 30_000): boolean {
  return Date.now() - lastUserInteractionTs < withinMs;
}

function isFormHeavyRoute(pathname: string): boolean {
  return FORM_HEAVY_ROUTE_RE.test(pathname);
}

/** Best-effort sniff: any form on the page with a non-empty input/textarea. */
function hasUnsavedInput(): boolean {
  if (typeof document === 'undefined') return false;
  const fields = document.querySelectorAll('input, textarea, select');
  for (const el of Array.from(fields)) {
    const t = (el as HTMLInputElement).type;
    if (t === 'hidden' || t === 'submit' || t === 'button') continue;
    const v = (el as HTMLInputElement).value;
    if (v && v.trim().length > 0) {
      // Skip cosmetic search bars by tag/aria hint — only true forms count.
      const isSearch = (el as HTMLElement).getAttribute('role') === 'searchbox'
        || t === 'search'
        || (el as HTMLInputElement).name === 'search'
        || (el as HTMLInputElement).placeholder?.toLowerCase().includes('rechercher');
      if (!isSearch) return true;
    }
  }
  return false;
}

async function fetchVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'omit',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.version === 'string' ? data.version : null;
  } catch {
    return null;
  }
}

function safeReload(opts: { allowDuringInput?: boolean } = {}) {
  // Never reload while the user is mid-keystroke — they'd lose what they're
  // typing. Caller can opt out (e.g. visibility change after long away).
  if (!opts.allowDuringInput && isUserActive(30_000)) return;
  // Never reload while a form has pending input on the page.
  if (hasUnsavedInput()) return;

  // Guard against an infinite reload loop if version.json itself is wrong.
  try {
    const last = sessionStorage.getItem(RELOAD_FLAG);
    const now = Date.now();
    if (last && now - Number(last) < 10_000) return;
    sessionStorage.setItem(RELOAD_FLAG, String(now));
  } catch {}
  window.location.reload();
}

export function useAppVersion() {
  const location = useLocation();
  const initialVersionRef = useRef<string | null>(null);
  const latestVersionRef = useRef<string | null>(null);
  const updateAvailableRef = useRef<boolean>(false);

  // 1. Boot: capture the version we loaded with.
  useEffect(() => {
    let cancelled = false;
    fetchVersion().then((v) => {
      if (cancelled) return;
      initialVersionRef.current = v;
      latestVersionRef.current = v;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Poll periodically + on visibility change.
  useEffect(() => {
    const check = async () => {
      const v = await fetchVersion();
      if (!v || !initialVersionRef.current) return;
      latestVersionRef.current = v;
      if (v !== initialVersionRef.current) {
        updateAvailableRef.current = true;
      }
    };

    const interval = window.setInterval(check, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        check();
        // If an update is queued and the user just came back, reload now —
        // they were away, so this is a "safe" moment. Allow input to count
        // as inactive (they were on another tab) but still respect any
        // unsaved form fields on the page.
        if (updateAvailableRef.current) safeReload({ allowDuringInput: true });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // 3. On every route change, if an update is pending, swap to the new build.
  // The user just navigated, so a reload feels like a normal page transition
  // — UNLESS they're stepping through a form-heavy flow (deposit-ad wizard,
  // dashboard settings, etc.) where a reload would wipe their progress.
  useEffect(() => {
    if (!updateAvailableRef.current) return;
    if (isFormHeavyRoute(location.pathname)) return;
    safeReload();
  }, [location.pathname]);

  // 4. Recover from stale-chunk errors caused by a deploy invalidating
  // the hashed bundles the current page is trying to lazy-load.
  useEffect(() => {
    const isChunkError = (msg: string) =>
      /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed/i.test(
        msg,
      );

    const onError = (e: ErrorEvent) => {
      // Chunk errors are unrecoverable for the current page anyway — force
      // the reload even mid-input (better than a broken white screen).
      if (e?.message && isChunkError(e.message)) safeReload({ allowDuringInput: true });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg =
        (e?.reason && (e.reason.message || String(e.reason))) || '';
      if (isChunkError(msg)) safeReload({ allowDuringInput: true });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
}
