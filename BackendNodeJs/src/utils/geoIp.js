/**
 * Lightweight client-IP + country resolver.
 *
 * - Honors the most common reverse-proxy headers (Cloudflare, Vercel, X-Forwarded-For).
 * - Returns { ip, country, country_code, city, region } — any field may be null.
 * - Country resolution is best-effort and free:
 *     1. CF-IPCountry header (Cloudflare, instant, no I/O).
 *     2. x-vercel-ip-country / x-vercel-ip-city / x-vercel-ip-country-region.
 *     3. Optional fallback to ipapi.co (only if env GEOIP_FALLBACK=1; we cache results in-memory).
 *
 * No external dependency required by default — keeps the deploy lean.
 */

const cache = new Map(); // ip -> { country, country_code, city, region, ts }
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Canonical list of the 24 Tunisian governorates with the spellings used in
 * our reference data. Upstream geo APIs return inconsistent variants
 * ("Tunis Governorate", "Beja", "Kebili", "Kef", "Medenine"…) — we normalize
 * them so the analytics dashboard groups visitors correctly.
 */
const TN_GOVERNORATES = [
  'Ariana','Béja','Ben Arous','Bizerte','Gabès','Gafsa','Jendouba','Kairouan',
  'Kasserine','Kébili','Le Kef','Mahdia','Manouba','Médenine','Monastir',
  'Nabeul','Sfax','Sidi Bouzid','Siliana','Sousse','Tataouine','Tozeur',
  'Tunis','Zaghouan',
];

function stripDiacritics(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeTunisianRegion(raw) {
  if (!raw) return null;
  let s = stripDiacritics(String(raw))
    .toLowerCase()
    .replace(/governorate|gouvernorat|province|region/gi, '')
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return null;
  const aliases = {
    'beja': 'Béja', 'gabes': 'Gabès', 'kebili': 'Kébili', 'kef': 'Le Kef',
    'le kef': 'Le Kef', 'medenine': 'Médenine', 'manubah': 'Manouba',
    'la manouba': 'Manouba', 'sidi bou zid': 'Sidi Bouzid',
    'sidi bouzid': 'Sidi Bouzid', 'tatahouine': 'Tataouine',
    'tunis city': 'Tunis', 'grand tunis': 'Tunis', 'ben arouss': 'Ben Arous',
    'arianah': 'Ariana', 'aryanah': 'Ariana',
  };
  if (aliases[s]) return aliases[s];
  for (const g of TN_GOVERNORATES) {
    const norm = stripDiacritics(g).toLowerCase();
    if (norm === s || s.includes(norm) || norm.includes(s)) return g;
  }
  return null;
}

function pickHeader(req, name) {
  const v = req.headers[name.toLowerCase()];
  if (!v) return null;
  return Array.isArray(v) ? v[0] : String(v);
}

function extractIp(req) {
  const xff = pickHeader(req, 'x-forwarded-for');
  if (xff) {
    // First entry is the original client.
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  return (
    pickHeader(req, 'cf-connecting-ip') ||
    pickHeader(req, 'x-real-ip') ||
    req.ip ||
    req.connection?.remoteAddress ||
    null
  );
}

async function fallbackLookup(ip) {
  if (process.env.GEOIP_FALLBACK !== '1' || !ip) return null;
  const cached = cache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const out = {
      country: data.country_name || null,
      country_code: data.country_code || null,
      city: data.city || null,
      region: data.region || null,
      ts: Date.now(),
    };
    cache.set(ip, out);
    return out;
  } catch {
    return null;
  }
}

// Best-effort IP-based lookup using ip-api.com (free, no key, ~45 req/min/IP).
// Used when no reverse-proxy header is present (typical for direct VPS hosting).
// Cached in-memory for 24h per IP, with a hard 1.2s timeout so request latency
// stays bounded even when the upstream is slow.
async function ipApiLookup(ip) {
  if (!ip) return null;
  // Skip private/loopback ranges — providers would just return "fail".
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|::1|fe80:|0\.0\.0\.0)/i.test(ip) || ip === '::1') return null;
  const cached = cache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached;

  // Try multiple free providers — ip-api.com first (most accurate for TN),
  // then ipwho.is, then geojs.io. Each capped at 1.2s so request latency
  // stays bounded even when an upstream is slow / down.
  const providers = [
    async () => {
      const r = await fetchJson(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,city,regionName`,
      );
      if (!r || r.status !== 'success') return null;
      return { country: r.country, country_code: r.countryCode, city: r.city, region: r.regionName };
    },
    async () => {
      const r = await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`);
      if (!r || r.success === false) return null;
      return { country: r.country, country_code: r.country_code, city: r.city, region: r.region };
    },
    async () => {
      const r = await fetchJson(`https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`);
      if (!r) return null;
      return { country: r.country, country_code: r.country_code, city: r.city, region: r.region };
    },
  ];

  for (const p of providers) {
    try {
      const data = await p();
      if (data && (data.country_code || data.country)) {
        const out = { ...data, ts: Date.now() };
        cache.set(ip, out);
        return out;
      }
    } catch { /* try next */ }
  }
  return null;
}

async function fetchJson(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function resolveGeo(req) {
  const ip = extractIp(req);
  const cfCountry = pickHeader(req, 'cf-ipcountry');
  const vercelCountry = pickHeader(req, 'x-vercel-ip-country');
  const vercelCity = pickHeader(req, 'x-vercel-ip-city');
  const vercelRegion = pickHeader(req, 'x-vercel-ip-country-region');

  let country_code = (cfCountry || vercelCountry || '').toUpperCase() || null;
  if (country_code === 'XX' || country_code === 'T1') country_code = null;

  let city = vercelCity ? decodeURIComponent(vercelCity) : null;
  let region = vercelRegion || null;
  let country = null;

  // 1) Try server-side IP lookup (free, public IP-API). This is the path that
  //    actually fires on a vanilla Node/Express VPS without Cloudflare/Vercel.
  if (!country_code) {
    const looked = await ipApiLookup(ip);
    if (looked) {
      country_code = looked.country_code;
      country = looked.country;
      city = city || looked.city;
      region = region || looked.region;
    }
  }

  // 2) Optional opt-in fallback (kept for backward compat).
  if (!country_code) {
    const looked = await fallbackLookup(ip);
    if (looked) {
      country_code = looked.country_code;
      country = looked.country;
      city = city || looked.city;
      region = region || looked.region;
    }
  }

  // 3) Final fallback: trust client-supplied geo (request body) if the client
  //    resolved it itself (e.g. via a browser geolocation lookup).
  const body = req.body || {};
  if (!country_code && body.client_country_code) {
    country_code = String(body.client_country_code).toUpperCase().slice(0, 2);
  }
  if (!country && body.client_country) country = String(body.client_country).slice(0, 80);
  if (!city && body.client_city) city = String(body.client_city).slice(0, 120);
  if (!region && body.client_region) region = String(body.client_region).slice(0, 120);

  // Tunisia-specific normalization: collapse upstream variants ("Tunis
  // Governorate", "Beja", "Kebili"…) into the canonical governorate spelling
  // used across the app, so the audience dashboard groups them correctly.
  if (country_code === 'TN') {
    const normalized =
      normalizeTunisianRegion(region) ||
      normalizeTunisianRegion(city) ||
      null;
    if (normalized) {
      region = normalized;
      // If the city upstream actually returned a governorate name, surface it
      // in `city` too so old dashboards (that read `by_city`) stay consistent.
      if (!city || normalizeTunisianRegion(city)) city = normalized;
    }
    if (!country) country = 'Tunisia';
  }

  return { ip, country, country_code, city, region };
}

module.exports = { resolveGeo, extractIp, normalizeTunisianRegion };
