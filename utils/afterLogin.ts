/**
 * Where to send a visitor once they have signed in, when signing in was
 * asked on the way to a page (e.g. "Déposer une annonce" while signed out).
 * Kept in sessionStorage so it survives the Google sign-in round trip
 * (Clerk → /sso-callback) and dies with the tab.
 */
const KEY = 'motoscoot_after_login';
const MAX_AGE_MS = 30 * 60 * 1000;

/** Only same-site paths: never an absolute or protocol-relative URL, never the callback itself. */
export const isSafeAfterLoginPath = (path: unknown): path is string =>
  typeof path === 'string' &&
  path.startsWith('/') &&
  !path.startsWith('//') &&
  !path.includes('\\') &&
  !/^\/sso-callback(\/|\?|$)/.test(path) &&
  path !== '/';

export const rememberAfterLogin = (path: string): void => {
  if (!isSafeAfterLoginPath(path)) return;
  try { sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() })); } catch { /* private mode */ }
};

export const forgetAfterLogin = (): void => {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
};

/** Reads the destination without consuming it. */
export const peekAfterLogin = (now = Date.now()): string | null => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw);
    if (!isSafeAfterLoginPath(path) || typeof at !== 'number' || now - at > MAX_AGE_MS) return null;
    return path;
  } catch {
    return null;
  }
};

/** Reads and forgets the destination. */
export const takeAfterLogin = (now = Date.now()): string | null => {
  const path = peekAfterLogin(now);
  forgetAfterLogin();
  return path;
};

export const DEPOSIT_PATH = '/deposer-une-annonce';
