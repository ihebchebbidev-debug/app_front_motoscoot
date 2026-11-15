/**
 * Decides WHEN an article / conseil counts as "seen": after the page has
 * been on screen (tab visible) for VIEW_DELAY_MS in total. A quick bounce,
 * a background tab or a prefetch never counts. Sent at most once per
 * content per browser tab session; the server also keeps one view per
 * visitor per day (BackendNodeJs/src/utils/contentViews.js).
 *
 * Pure and dependency-injected so it runs under `node --test`.
 */
export const VIEW_DELAY_MS = 5000;

export interface ViewEnv {
  /** Is the tab currently visible? */
  isVisible: () => boolean;
  /** Subscribe to visibility changes; returns an unsubscribe function. */
  onVisibilityChange: (cb: () => void) => () => void;
  setTimer: (cb: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  now: () => number;
  /** Per-tab "already sent" memory (sessionStorage); may be missing. */
  wasSent: (key: string) => boolean;
  markSent: (key: string) => void;
}

/** Starts watching; returns a cleanup to call when the page goes away. */
export function scheduleContentView(
  key: string,
  send: () => void,
  env: ViewEnv,
  delayMs: number = VIEW_DELAY_MS,
): () => void {
  if (!key || env.wasSent(key)) return () => {};

  let remaining = delayMs;
  let startedAt = 0;
  let timer: unknown = null;
  let done = false;

  const fire = () => {
    if (done) return;
    done = true;
    timer = null;
    env.markSent(key);
    send();
  };
  const start = () => {
    if (done || timer !== null) return;
    startedAt = env.now();
    timer = env.setTimer(fire, remaining);
  };
  const pause = () => {
    if (timer === null) return;
    env.clearTimer(timer);
    timer = null;
    remaining = Math.max(0, remaining - (env.now() - startedAt));
  };

  if (env.isVisible()) start();
  const unsubscribe = env.onVisibilityChange(() => (env.isVisible() ? start() : pause()));

  return () => {
    done = true;
    pause();
    unsubscribe();
  };
}

/** Browser implementation of ViewEnv. */
export function browserViewEnv(): ViewEnv {
  const safe = <T,>(fn: () => T, fallback: T): T => {
    try { return fn(); } catch { return fallback; }
  };
  return {
    isVisible: () => document.visibilityState === 'visible',
    onVisibilityChange: (cb) => {
      document.addEventListener('visibilitychange', cb);
      return () => document.removeEventListener('visibilitychange', cb);
    },
    setTimer: (cb, ms) => window.setTimeout(cb, ms),
    clearTimer: (h) => window.clearTimeout(h as number),
    now: () => Date.now(),
    wasSent: (key) => safe(() => sessionStorage.getItem(`ms_view:${key}`) === '1', false),
    markSent: (key) => { safe(() => sessionStorage.setItem(`ms_view:${key}`, '1'), undefined); },
  };
}
