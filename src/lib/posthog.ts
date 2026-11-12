/**
 * PostHog, behind the cookie banner and off the first load.
 *
 * - Consent: nothing is loaded, stored or sent until the visitor clicks
 *   « Accepter » in the cookie banner (localStorage motoscoot_cookie_consent =
 *   'accepted', the same signal Google Analytics follows). Refusing later
 *   stops capture (opt_out_capturing).
 * - Weight: posthog-js is imported dynamically, once the page is idle, so it
 *   stays out of the main bundle (PageSpeed; same rule as Clerk and
 *   socket.io-client in AGENTS.md).
 * - Calls made before it is ready (capture, identify…) wait in a short queue;
 *   without consent they are dropped.
 *
 * Keys come from VITE_PUBLIC_POSTHOG_KEY / VITE_PUBLIC_POSTHOG_HOST (.env
 * locally, Vercel environment variables in production). Without them, every
 * call is a no-op.
 */
import type { PostHog } from 'posthog-js';

type Props = Record<string, unknown>;

const env = (import.meta as unknown as { env: Record<string, string | boolean | undefined> }).env;
const KEY = String(env.VITE_PUBLIC_POSTHOG_KEY || '');
const HOST = String(env.VITE_PUBLIC_POSTHOG_HOST || '');
export const CONSENT_KEY = 'motoscoot_cookie_consent';

export const isPostHogConfigured = Boolean(KEY && HOST);

if (!isPostHogConfigured && env.DEV) {
  // eslint-disable-next-line no-console
  console.info('[posthog] VITE_PUBLIC_POSTHOG_KEY / VITE_PUBLIC_POSTHOG_HOST not set: analytics disabled.');
}

export function hasAnalyticsConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accepted';
  } catch {
    return false;
  }
}

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;
const queue: Array<(ph: PostHog) => void> = [];
const MAX_QUEUE = 50;

function load(): Promise<PostHog | null> {
  if (client) return Promise.resolve(client);
  if (!isPostHogConfigured || !hasAnalyticsConsent()) return Promise.resolve(null);
  if (!loading) {
    loading = import('posthog-js')
      .then(({ default: ph }) => {
        ph.init(KEY, {
          api_host: HOST,
          defaults: '2026-08-30',
          logs: { serviceName: 'moto-scoot-web', environment: String(env.MODE || '') },
          capture_exceptions: {
            capture_unhandled_errors: true,
            capture_unhandled_rejections: true,
            capture_console_errors: false,
          },
        } as Parameters<PostHog['init']>[1]);
        client = ph;
        queue.splice(0).forEach((fn) => {
          try { fn(ph); } catch { /* never break the page for analytics */ }
        });
        return ph;
      })
      .catch(() => {
        loading = null;
        return null;
      });
  }
  return loading;
}

/** Load PostHog when the browser is idle, if the visitor has accepted cookies. */
export function startPostHog(): void {
  if (!isPostHogConfigured || !hasAnalyticsConsent() || typeof window === 'undefined') return;
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  const go = () => { void load(); };
  if (w.requestIdleCallback) w.requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 2000);
}

/** Called by the cookie banner when the visitor chooses. */
export function updatePostHogConsent(granted: boolean): void {
  if (granted) {
    client?.opt_in_capturing();
    void load();
  } else {
    client?.opt_out_capturing();
    queue.length = 0;
  }
}

function run(fn: (ph: PostHog) => void): void {
  if (client) {
    try { fn(client); } catch { /* ignore */ }
    return;
  }
  if (!isPostHogConfigured || !hasAnalyticsConsent()) return;
  if (queue.length < MAX_QUEUE) queue.push(fn);
  void load();
}

type Logger = { info?: (m: string, p?: Props) => void; warn?: (m: string, p?: Props) => void; error?: (m: string, p?: Props) => void };
const logger = (ph: PostHog) => (ph as unknown as { logger?: Logger }).logger;

export const analytics = {
  capture(event: string, properties?: Props) {
    run((ph) => ph.capture(event, properties));
  },
  identify(userId: string, properties?: Props) {
    run((ph) => ph.identify(userId, properties));
  },
  reset() {
    if (client) client.reset();
  },
  captureException(error: unknown, properties?: Props) {
    run((ph) => ph.captureException(error, properties));
  },
  log(level: 'info' | 'warn' | 'error', message: string, properties?: Props) {
    run((ph) => logger(ph)?.[level]?.(message, properties));
  },
};
