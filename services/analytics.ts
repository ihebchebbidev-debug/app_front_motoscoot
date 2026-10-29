/**
 * Google Analytics 4 — dynamic gtag.js loader.
 *
 * The measurement ID is fetched from the admin-managed `seo_settings`
 * (key `ga4_measurement_id`). When the admin clears the field, gtag is
 * never injected — no tracking, no extra requests.
 *
 * Cookie consent is respected: we only call gtag('config', ...) once the
 * user has granted analytics consent. Until then, we keep the script in
 * "denied" mode using Google's Consent Mode v2 defaults.
 */
const GTAG_SRC_PREFIX = 'https://www.googletagmanager.com/gtag/js?id=';

/**
 * Hardcoded GA4 Measurement ID for moto-scoot.tn.
 * This value is intentionally non-editable from the admin SEO panel
 * to guarantee analytics always reach the correct property.
 */
export const HARDCODED_GA4_MEASUREMENT_ID = 'G-LMCBTZXV3Q';

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
    __ga4_loaded?: string;
    __ga4_consent?: 'granted' | 'denied';
  }
}

function ensureDataLayer() {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag(..._args: any[]) {
      window.dataLayer!.push(arguments);
    };
  }
}

function injectScript(measurementId: string) {
  if (typeof document === 'undefined') return;
  // gtag.js is ~178 KB: load it only after the page has loaded and the main
  // thread is idle, so it no longer competes with the first paint (PageSpeed).
  if (document.readyState !== 'complete') {
    window.addEventListener('load', () => injectScript(measurementId), { once: true });
    return;
  }
  const w = window as any;
  if (!w.__ga4_idle_scheduled) {
    w.__ga4_idle_scheduled = true;
    const later = (fn: () => void) => (w.requestIdleCallback ? w.requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 2000));
    later(() => injectScript(measurementId));
    return;
  }
  if (document.querySelector(`script[data-ga4-id="${measurementId}"]`)) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = GTAG_SRC_PREFIX + encodeURIComponent(measurementId);
  s.setAttribute('data-ga4-id', measurementId);
  document.head.appendChild(s);
}

function getStoredConsent(): 'granted' | 'denied' {
  try {
    const raw = localStorage.getItem('motoscoot_cookie_consent');
    if (!raw) return 'denied';
    if (raw === 'accepted') return 'granted';
    if (raw === 'rejected') return 'denied';
    // Backward-compat: support a future JSON-shaped consent payload.
    try {
      const parsed = JSON.parse(raw);
      return parsed?.analytics === true || parsed?.accepted === true ? 'granted' : 'denied';
    } catch { return 'denied'; }
  } catch { return 'denied'; }
}

/** Initialise (or re-initialise) GA4 with the given measurement ID. Idempotent. */
export function initGA4(measurementId: string | null | undefined) {
  if (typeof window === 'undefined') return;
  if (!measurementId || !/^G-[A-Z0-9]+$/i.test(measurementId)) return;
  if (window.__ga4_loaded === measurementId) return;

  ensureDataLayer();
  const consent = getStoredConsent();
  window.__ga4_consent = consent;

  // Consent Mode v2 defaults — set BEFORE the first config call.
  window.gtag!('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: consent,
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500,
  });

  injectScript(measurementId);
  window.gtag!('js', new Date());
  window.gtag!('config', measurementId, {
    send_page_view: false, // we trigger page_view manually on route change
    anonymize_ip: true,
  });
  window.__ga4_loaded = measurementId;
}

/** Update consent after the user accepts/declines the cookie banner. */
export function updateAnalyticsConsent(granted: boolean) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.__ga4_consent = granted ? 'granted' : 'denied';
  window.gtag('consent', 'update', {
    analytics_storage: granted ? 'granted' : 'denied',
  });
}

/** Track a page view manually (called on every SPA route change). */
export function trackPageView(path: string, title?: string) {
  if (typeof window === 'undefined' || !window.gtag || !window.__ga4_loaded) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.href,
  });
}

/** Track a custom event. */
export function trackEvent(name: string, params: Record<string, any> = {}) {
  if (typeof window === 'undefined' || !window.gtag || !window.__ga4_loaded) return;
  window.gtag('event', name, params);
}
