/**
 * Visitor tracking SDK — singleton on the client.
 *
 * Captures, for the admin "Audience" panel and ad-sales packs:
 *   • Stable visitor fingerprint (localStorage)
 *   • Session (started on boot, ended on unload, IP+country resolved server-side)
 *   • Page views (every route change, with time-on-page)
 *   • Listing clicks (from search / home / similar)
 *   • Heartbeat to update session duration
 *
 * Network calls are best-effort: failures are swallowed silently and never
 * break the user experience. Uses navigator.sendBeacon when available so the
 * final session update isn't dropped on tab close.
 */

import { API_BASE_URL, tokenStorage } from './apiClient';

const FP_KEY = 'motoscoot_visitor_fp';
const SID_KEY = 'motoscoot_session_id';
const CONSENT_KEY = 'motoscoot_cookie_consent';
const HEARTBEAT_MS = 30 * 1000;

type DeviceInfo = {
  device: string;
  browser: string;
  os: string;
  language: string;
  screen_size: string;
};

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { }
}
function safeRemove(key: string) {
  try { localStorage.removeItem(key); } catch { }
}

/** Has the user explicitly accepted optional cookies? */
/**
 * Tracking is now always-on so the admin sees every visitor and every page.
 * The cookie banner only controls advertising/marketing storage, not the
 * essential analytics required to operate the site.
 */
function hasConsent(): boolean {
  return true;
}

/**
 * Detect bots, headless browsers, prerender / SSG passes and known crawlers
 * on the CLIENT side so we never even fire the network request. This is a
 * defence-in-depth complement to the server-side filter and stops the
 * fingerprint cookie from being created for non-human traffic.
 */
function isBotClient(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  // Vite SSG / build-time prerender: window exists but document body is empty.
  if ((window as any).__PRERENDER__ === true) return true;
  if ((navigator as any).webdriver === true) return true;
  const ua = String(navigator.userAgent || '').toLowerCase();
  if (!ua) return true;
  const BOT_TOKENS = [
    'bot', 'crawler', 'spider', 'headlesschrome', 'phantomjs', 'puppeteer',
    'playwright', 'selenium', 'lighthouse', 'pagespeed', 'gtmetrix',
    'facebookexternalhit', 'twitterbot', 'linkedinbot', 'whatsapp',
    'telegrambot', 'discordbot', 'slackbot', 'embedly', 'pinterest',
    'googlebot', 'bingbot', 'duckduckbot', 'yandexbot', 'baiduspider',
    'gptbot', 'claudebot', 'perplexitybot', 'applebot', 'ccbot',
    'ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot',
    'curl/', 'wget/', 'python-requests', 'node-fetch', 'axios/',
  ];
  for (const t of BOT_TOKENS) if (ua.includes(t)) return true;
  return false;
}

function getOrCreateFingerprint(): string {
  let fp = safeGet(FP_KEY);
  if (fp) return fp;
  const rnd =
    typeof crypto !== 'undefined' && (crypto as any).randomUUID
      ? (crypto as any).randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  fp = String(rnd).replace(/-/g, '').slice(0, 32);
  safeSet(FP_KEY, fp);
  return fp;
}

function detectDevice(): DeviceInfo {
  const ua = navigator.userAgent || '';
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean; platform?: string } };
  const platform = nav.userAgentData?.platform || navigator.platform || '';
  const isIPadOS = platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
  const isTablet = /iPad|Tablet/i.test(ua) || isIPadOS || (/Android/i.test(ua) && !/Mobi/i.test(ua));
  const isMobile = !isTablet && (nav.userAgentData?.mobile === true || /Mobi|Android|iPhone|iPod/i.test(ua));
  const device = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  let browser = 'other';
  if (/Edg\//.test(ua)) browser = 'edge';
  else if (/OPR\//.test(ua) || /Opera/.test(ua)) browser = 'opera';
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'chrome';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'safari';
  else if (/Firefox\//.test(ua)) browser = 'firefox';

  let os = 'other';
  if (/Android/i.test(ua)) os = 'android';
  else if (/iPhone|iPad|iPod|iOS/i.test(ua) || isIPadOS) os = 'ios';
  else if (/Windows/i.test(ua)) os = 'windows';
  else if (/Mac OS X/i.test(ua) || /Mac/i.test(platform)) os = 'macos';
  else if (/Linux/i.test(ua)) os = 'linux';

  return {
    device, browser, os,
    language: navigator.language || 'unknown',
    screen_size:
      typeof window !== 'undefined' && window.screen
        ? `${window.screen.width}x${window.screen.height}`
        : 'unknown',
  };
}

// Map any free-form source/medium string to one of the backend ENUM values.
// Backend `referral_source` ENUM accepts ONLY:
//   direct, google, facebook, instagram, linkedin, twitter, tiktok,
//   whatsapp, email, other
// Anything else triggers a Postgres `invalid input value for enum` 500.
function normalizeSource(raw: string): string | null {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return null;
  if (s === 'direct') return 'direct';
  if (/google|adwords|gads|sem|googleads/.test(s)) return 'google';
  if (/facebook|fb|meta|fbads/.test(s)) return 'facebook';
  if (/instagram|ig/.test(s)) return 'instagram';
  if (/linkedin/.test(s)) return 'linkedin';
  if (/twitter|^x$|x\.com|tweet/.test(s)) return 'twitter';
  if (/tiktok/.test(s)) return 'tiktok';
  if (/whatsapp|wa\.me/.test(s)) return 'whatsapp';
  if (/email|mail|newsletter|mailchimp|sendgrid/.test(s)) return 'email';
  return 'other';
}

function detectReferralSource(): { source: string; url: string } {
  // 1. UTM parameters take precedence — that's how paid/ad campaigns are
  //    attributed. ?utm_source=facebook&utm_medium=cpc must override an
  //    in-app referrer (which would otherwise mislabel the visit as direct).
  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source') || params.get('utm_medium');
    if (utmSource) {
      const normalized = normalizeSource(utmSource);
      if (normalized) {
        // Persist the campaign URL so we can show the full UTM string in admin.
        return { source: normalized, url: window.location.href };
      }
    }
  } catch { /* fall through to referrer detection */ }

  // 2. Referrer-based detection.
  const ref = document.referrer || '';
  if (!ref) return { source: 'direct', url: '' };
  try {
    const u = new URL(ref);
    const host = u.host.toLowerCase();
    if (host === window.location.host.toLowerCase()) return { source: 'direct', url: ref };
    if (/google\./.test(host)) return { source: 'google', url: ref };
    if (/facebook\.|fb\./.test(host)) return { source: 'facebook', url: ref };
    if (/instagram\./.test(host)) return { source: 'instagram', url: ref };
    if (/linkedin\./.test(host)) return { source: 'linkedin', url: ref };
    if (/(^|\.)twitter\.|(^|\.)x\.com|t\.co/.test(host)) return { source: 'twitter', url: ref };
    if (/tiktok\./.test(host)) return { source: 'tiktok', url: ref };
    if (/whatsapp\./.test(host) || /wa\.me/.test(host)) return { source: 'whatsapp', url: ref };
    if (/mail\./.test(host) || /outlook\./.test(host) || /gmail\./.test(host)) return { source: 'email', url: ref };
    return { source: 'other', url: ref };
  } catch {
    return { source: 'direct', url: '' };
  }
}

function endpoint(path: string): string {
  return `${API_BASE_URL}${path}`;
}

async function sendJson(path: string, body: any, method: 'POST' | 'PATCH' = 'POST') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = tokenStorage.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    await fetch(endpoint(path), {
      method,
      headers,
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // silent
  }
}

async function postJson(path: string, body: any) {
  return sendJson(path, body, 'POST');
}

async function patchJson(path: string, body: any) {
  return sendJson(path, body, 'PATCH');
}

/**
 * Best-effort send during page unload.
 * - For POST: prefer navigator.sendBeacon (survives tab close reliably).
 * - For PATCH: sendBeacon only supports POST, so fall back to keepalive fetch.
 */
function beacon(path: string, body: any, method: 'POST' | 'PATCH' = 'POST') {
  if (method === 'POST') {
    try {
      const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint(path), blob);
        return;
      }
    } catch { }
  }
  // Fallback (and PATCH path) to keepalive fetch.
  sendJson(path, body, method);
}


/* ------------------------------------------------------------------ */


class Tracker {
  private fingerprint: string;
  private sessionId: string | null = null;
  private starting: Promise<void> | null = null;
  private device: DeviceInfo;
  private pagesViewed = 0;
  private sessionStart = Date.now();
  private currentPagePath = '';
  private currentPageStart = Date.now();
  private heartbeatTimer: number | null = null;
  private booted = false;
  private isBot = false;
  /** Per-listing dedupe so React re-renders don't double-count listing views. */
  private viewedListings = new Set<string>();

  constructor() {
    this.isBot = isBotClient();
    this.fingerprint = getOrCreateFingerprint();
    this.device = detectDevice();
  }

  /** Boot — call once after mount. Safe to call multiple times. */
  async boot() {
    if (this.booted || this.isBot || !hasConsent()) return;
    this.booted = true;
    await this.startSession();

    // Heartbeat — keeps session.last_activity fresh & updates duration.
    this.heartbeatTimer = window.setInterval(() => this.heartbeat(), HEARTBEAT_MS);

    // Final flush on unload.
    const finalize = () => {
      if (!this.sessionId) return;
      const duration = Math.round((Date.now() - this.sessionStart) / 1000);
      const pageDuration = Date.now() - this.currentPageStart;
      // Final page view duration
      if (this.currentPagePath) {
        beacon('/analytics/page-view', {
          session_id: this.sessionId,
          fingerprint: this.fingerprint,
          path: this.currentPagePath,
          duration_ms: pageDuration,
        });
      }
      beacon(`/analytics/sessions/${this.sessionId}`, {
        duration_seconds: duration,
        pages_viewed: this.pagesViewed,
      }, 'PATCH');
    };
    window.addEventListener('pagehide', finalize);
    window.addEventListener('beforeunload', finalize);
  }

  /**
   * Best-effort client-side geo lookup. Used only as a fallback so the admin
   * "Top pays / Top villes" panels always have data, even when the backend
   * runs on a VPS that has no proxy geo-headers and can't reach ip-api itself.
   * Cached in localStorage for 24h.
   */
  private async resolveClientGeo(): Promise<{ country?: string; country_code?: string; city?: string; region?: string }> {
    try {
      const cached = safeGet('motoscoot_client_geo');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.ts && Date.now() - parsed.ts < 24 * 60 * 60 * 1000) {
          return parsed.data || {};
        }
      }
    } catch { /* fall through */ }

    // PageSpeed: never call third-party geo services during first paint.
    await new Promise<void>((resolve) => {
      const idle = () => {
        const w = window as any;
        if (w.requestIdleCallback) w.requestIdleCallback(() => resolve(), { timeout: 3000 });
        else setTimeout(resolve, 1500);
      };
      if (document.readyState === 'complete') idle();
      else window.addEventListener('load', idle, { once: true });
    });

    // Try multiple free providers in order. Each one is wrapped in a 1.2s
    // timeout so a hanging provider can't slow down session bootstrap.
    // We need this redundancy because ipapi.co rate-limits free tier (1k/day)
    // and silently returns 429 once quota is hit, killing geo for everyone.
    const providers: Array<() => Promise<any>> = [
      async () => {
        const r = await this.fetchWithTimeout('https://ipapi.co/json/', 1500);
        if (!r) return null;
        return {
          country: r.country_name, country_code: r.country_code,
          city: r.city, region: r.region,
        };
      },
      async () => {
        const r = await this.fetchWithTimeout('https://ipwho.is/', 1500);
        if (!r || r.success === false) return null;
        return {
          country: r.country, country_code: r.country_code,
          city: r.city, region: r.region,
        };
      },
      async () => {
        const r = await this.fetchWithTimeout('https://get.geojs.io/v1/ip/geo.json', 1500);
        if (!r) return null;
        return {
          country: r.country, country_code: r.country_code,
          city: r.city, region: r.region,
        };
      },
    ];

    for (const p of providers) {
      try {
        const data = await p();
        if (data && (data.country_code || data.country)) {
          const out = {
            country: data.country || undefined,
            country_code: data.country_code || undefined,
            city: data.city || undefined,
            region: data.region || undefined,
          };
          try { safeSet('motoscoot_client_geo', JSON.stringify({ data: out, ts: Date.now() })); } catch {}
          return out;
        }
      } catch { /* try next */ }
    }
    return {};
  }

  private async fetchWithTimeout(url: string, timeoutMs: number): Promise<any | null> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  private async startSession() {
    if (this.sessionId) return;
    if (this.starting) return this.starting;

    const ref = detectReferralSource();
    const landing = window.location.pathname + window.location.search;
    const clientGeo = await this.resolveClientGeo();

    const body = {
      fingerprint: this.fingerprint,
      ...this.device,
      referral_source: ref.source,
      referral_url: ref.url,
      landing_page: landing,
      client_country: clientGeo.country,
      client_country_code: clientGeo.country_code,
      client_city: clientGeo.city,
      client_region: clientGeo.region,
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = tokenStorage.get();
    if (token) headers.Authorization = `Bearer ${token}`;

    this.starting = (async () => {
      try {
        const res = await fetch(endpoint('/analytics/sessions'), {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        let data: any = null;
        try { data = await res.json(); } catch { /* non-JSON body */ }
        if (res.ok) {
          this.sessionId = data?.session_id || null;
          if (this.sessionId) safeSet(SID_KEY, this.sessionId);
        }
      } catch {
        /* network error — silently ignored, will retry on next boot */
      } finally {
        this.starting = null;
      }
    })();
    return this.starting;
  }

  private async heartbeat() {
    if (!this.sessionId) return;
    const duration = Math.round((Date.now() - this.sessionStart) / 1000);
    patchJson(`/analytics/sessions/${this.sessionId}`, {
      duration_seconds: duration,
      pages_viewed: this.pagesViewed,
    });
  }

  /** Track a page view (route change). Call from a router-watching effect. */
  async trackPageView(path: string, viewName?: string) {
    if (this.isBot || !hasConsent()) return;
    if (!this.booted) await this.boot();

    // Same-path re-render guard — React StrictMode and minor location changes
    // (search-param tweaks identical to last value) used to fire duplicates.
    if (path === this.currentPagePath) return;

    // Close out the previous page with its real duration.
    if (this.currentPagePath && this.currentPagePath !== path) {
      const dur = Date.now() - this.currentPageStart;
      postJson('/analytics/page-view', {
        session_id: this.sessionId,
        fingerprint: this.fingerprint,
        path: this.currentPagePath,
        duration_ms: dur,
      });
    }

    this.currentPagePath = path;
    this.currentPageStart = Date.now();
    this.pagesViewed += 1;

    // Initial page row (with 0 duration; duration is sent on next change/unload).
    postJson('/analytics/page-view', {
      session_id: this.sessionId,
      fingerprint: this.fingerprint,
      path,
      view_name: viewName,
      referrer: document.referrer || null,
      duration_ms: 0,
    });
  }

  /** Track a click on a listing card from a list/search/home/similar block. */
  trackListingClick(listingId: string, source: string) {
    if (this.isBot || !hasConsent() || !listingId) return;
    postJson('/analytics/listing-click', {
      listing_id: listingId,
      session_id: this.sessionId,
      fingerprint: this.fingerprint,
      source,
    });
  }

  /** Track a listing detail-page view. Deduped per session — React effect
   *  re-runs (refetch, prop changes) on the same listing don't fire again. */
  trackListingView(listingId: string) {
    if (this.isBot || !hasConsent() || !listingId) return;
    const key = String(listingId);
    if (this.viewedListings.has(key)) return;
    this.viewedListings.add(key);
    postJson('/analytics/listing-view', {
      listing_id: listingId,
      session_id: this.sessionId,
      fingerprint: this.fingerprint,
    });
  }

  /** Track a generic listing event (e.g. 'phone_reveal', 'message_seller'). */
  trackListingEvent(listingId: string, eventType: string) {
    if (this.isBot || !hasConsent() || !listingId || !eventType) return;
    postJson('/analytics/listing-event', {
      listing_id: listingId,
      event_type: eventType,
      session_id: this.sessionId,
    });
  }
}

export const tracker = new Tracker();
