/**
 * seoSettingsController — admin-managed SEO + analytics configuration.
 *
 *   Public:
 *     GET  /api/site-settings/seo            → only safe-to-expose fields
 *                                              (used by SEO.tsx + gtag loader)
 *
 *   Admin (auth + requireAdmin enforced by router):
 *     GET  /api/admin/site-settings/seo      → full payload (incl. secrets)
 *     PUT  /api/admin/site-settings/seo      → upsert
 *     POST /api/admin/seo/ga4-report         → proxy GA4 Data API
 *     POST /api/admin/seo/gsc-report         → proxy Search Console API
 *     GET  /api/admin/seo/test-credentials   → smoke-test the service account
 *
 * Sensitive credentials (service-account JSON, GA4 API secret) are kept
 * server-side and ONLY exposed through admin endpoints. The public endpoint
 * strips them out before sending.
 */
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { ga4RunReport, gscQuery, parseServiceAccount } = require('../services/googleApiService');

const KEY = 'seo_settings';

const DEFAULTS = {
  default_title: null,
  title_template: '%s | MotoScoot',
  default_description: null,
  default_keywords: null,
  default_og_image: null,
  twitter_handle: '@motoscoot_tn',
  organization_name: 'MotoScoot',
  organization_logo: null,
  organization_phone: null,
  organization_email: null,
  organization_address: null,
  ga4_measurement_id: null,
  ga4_api_secret: null,
  ga4_property_id: null,
  gsc_verification_code: null,
  gsc_site_url: null,
  google_service_account: null,
  robots_extra: null,
  enable_analytics: true,
  enable_organization_jsonld: true,
};

const SAFE_PUBLIC_FIELDS = [
  'default_title',
  'title_template',
  'default_description',
  'default_keywords',
  'default_og_image',
  'twitter_handle',
  'organization_name',
  'organization_logo',
  'organization_phone',
  'organization_email',
  'organization_address',
  'ga4_measurement_id',          // ID itself is public (it's in gtag.js anyway)
  'gsc_verification_code',       // meta tag is public by design
  'enable_analytics',
  'enable_organization_jsonld',
];

const STRING_FIELDS = new Set([
  'default_title', 'title_template', 'default_description', 'default_keywords',
  'default_og_image', 'twitter_handle', 'organization_name', 'organization_logo',
  'organization_phone', 'organization_email', 'organization_address',
  'ga4_measurement_id', 'ga4_api_secret', 'ga4_property_id',
  'gsc_verification_code', 'gsc_site_url', 'robots_extra',
]);

const BOOL_FIELDS = new Set(['enable_analytics', 'enable_organization_jsonld']);
const JSON_FIELDS = new Set(['google_service_account']);

const FIELD_LIMITS = {
  default_title: 200,
  title_template: 120,
  default_description: 400,
  default_keywords: 600,
  default_og_image: 600,
  twitter_handle: 64,
  organization_name: 120,
  organization_logo: 600,
  organization_phone: 64,
  organization_email: 200,
  organization_address: 400,
  ga4_measurement_id: 64,
  ga4_api_secret: 200,
  ga4_property_id: 64,
  gsc_verification_code: 200,
  gsc_site_url: 400,
  robots_extra: 4000,
};

function sanitize(input) {
  const out = {};
  for (const [field, raw] of Object.entries(input || {})) {
    if (STRING_FIELDS.has(field)) {
      if (raw === null || raw === '' || raw === undefined) { out[field] = null; continue; }
      if (typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      out[field] = trimmed ? trimmed.slice(0, FIELD_LIMITS[field] || 1000) : null;
    } else if (BOOL_FIELDS.has(field)) {
      out[field] = !!raw;
    } else if (JSON_FIELDS.has(field)) {
      if (raw === null || raw === '' || raw === undefined) { out[field] = null; continue; }
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) { out[field] = null; continue; }
        try { out[field] = JSON.parse(trimmed); }
        catch { /* keep as raw string so admin can correct it */ out[field] = trimmed; }
      } else if (typeof raw === 'object') {
        out[field] = raw;
      }
    }
  }
  return out;
}

async function readRow() {
  const { rows } = await query(`SELECT value, updated_at FROM site_settings WHERE key=$1 LIMIT 1`, [KEY]);
  const v = rows[0]?.value || {};
  return { value: { ...DEFAULTS, ...v }, updated_at: rows[0]?.updated_at || null };
}

async function writeRow(value, userId) {
  await query(
    `INSERT INTO site_settings (key, value, updated_by)
          VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value,
              updated_by = EXCLUDED.updated_by`,
    [KEY, JSON.stringify(value), userId]
  );
}

/* ---------- Public ---------- */
async function getPublic(_req, res, next) {
  try {
    const { value, updated_at } = await readRow();
    const safe = {};
    for (const f of SAFE_PUBLIC_FIELDS) safe[f] = value[f] ?? null;
    res.json({ ...safe, updated_at });
  } catch (err) {
    logger.error('seo.getPublic failed:', err.message);
    next(err);
  }
}

/* ---------- Admin ---------- */
async function getAdmin(_req, res, next) {
  try {
    const { value, updated_at } = await readRow();
    // Mark presence of secrets without returning private_key blob unnecessarily.
    const hasServiceAccount = !!(value.google_service_account && value.google_service_account.client_email);
    res.json({
      ...value,
      _meta: {
        has_service_account: hasServiceAccount,
        service_account_email: hasServiceAccount ? value.google_service_account.client_email : null,
        updated_at,
      },
    });
  } catch (err) {
    logger.error('seo.getAdmin failed:', err.message);
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const incoming = sanitize(req.body || {});
    const { value: current } = await readRow();
    const merged = { ...current, ...incoming };
    await writeRow(merged, req.user?.id || null);
    res.json({ ok: true, value: merged });
  } catch (err) {
    logger.error('seo.update failed:', err.message);
    next(err);
  }
}

async function ga4Report(req, res, next) {
  try {
    const { value } = await readRow();
    const propertyId = req.body?.propertyId || value.ga4_property_id;
    const reportBody = req.body?.body || {
      dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'sessions' },
        { name: 'engagementRate' },
      ],
      dimensions: [{ name: 'date' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: 100,
    };
    const data = await ga4RunReport({
      serviceAccount: value.google_service_account,
      propertyId,
      body: reportBody,
    });
    res.json(data);
  } catch (err) {
    logger.warn('seo.ga4Report failed:', err.message);
    res.status(400).json({ error: err.message });
  }
}

async function gscReport(req, res, next) {
  try {
    const { value } = await readRow();
    const siteUrl = req.body?.siteUrl || value.gsc_site_url;
    const days = Number(req.body?.days) || 28;
    const end = new Date(); const start = new Date(); start.setDate(end.getDate() - days);
    const fmt = (d) => d.toISOString().slice(0, 10);
    const reportBody = req.body?.body || {
      startDate: fmt(start),
      endDate: fmt(end),
      dimensions: ['query'],
      rowLimit: 25,
    };
    const data = await gscQuery({
      serviceAccount: value.google_service_account,
      siteUrl,
      body: reportBody,
    });
    res.json(data);
  } catch (err) {
    logger.warn('seo.gscReport failed:', err.message);
    res.status(400).json({ error: err.message });
  }
}

async function testCredentials(_req, res) {
  try {
    const { value } = await readRow();
    const creds = parseServiceAccount(value.google_service_account);
    const checks = {
      service_account_email: creds.client_email,
      ga4_property_id: value.ga4_property_id || null,
      gsc_site_url: value.gsc_site_url || null,
      ga4: { ok: false, error: null },
      gsc: { ok: false, error: null },
    };
    if (value.ga4_property_id) {
      try {
        await ga4RunReport({
          serviceAccount: value.google_service_account,
          propertyId: value.ga4_property_id,
          body: { dateRanges: [{ startDate: 'yesterday', endDate: 'today' }], metrics: [{ name: 'activeUsers' }], limit: 1 },
        });
        checks.ga4.ok = true;
      } catch (e) { checks.ga4.error = e.message; }
    } else { checks.ga4.error = 'GA4 property ID not set.'; }

    if (value.gsc_site_url) {
      try {
        const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 7);
        await gscQuery({
          serviceAccount: value.google_service_account,
          siteUrl: value.gsc_site_url,
          body: { startDate: start.toISOString().slice(0,10), endDate: end.toISOString().slice(0,10), dimensions: ['query'], rowLimit: 1 },
        });
        checks.gsc.ok = true;
      } catch (e) { checks.gsc.error = e.message; }
    } else { checks.gsc.error = 'Search Console site URL not set.'; }

    res.json(checks);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/* ---------- Public robots.txt (merges admin `robots_extra`) ---------- */
const ROBOTS_BASE = `# MotoScoot.tn — robots.txt (dynamic)
User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /dashboard
Disallow: /mon-compte
Disallow: /espace-pro
Disallow: /mes-favoris
Disallow: /reinitialiser-mot-de-passe
Disallow: /deposer-une-annonce
Disallow: /api/

Disallow: /*?utm_*
Disallow: /*?fbclid=
Disallow: /*?gclid=
Crawl-delay: 1
`;

function buildRobots(value, host) {
  const extra = (value.robots_extra || '').trim();
  const sitemapHost = host || 'https://www.moto-scoot.tn';
  const tail = `\nSitemap: ${sitemapHost}/sitemap-dynamic.xml\nHost: ${sitemapHost}\n`;
  return ROBOTS_BASE + (extra ? `\n# ---- Admin custom rules ----\n${extra}\n` : '') + tail;
}

async function getRobots(req, res, next) {
  try {
    const { value } = await readRow();
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').toString().split(',')[0];
    const host  = req.headers['x-forwarded-host'] || req.get('host');
    const origin = host ? `${proto}://${host}` : null;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(buildRobots(value, origin));
  } catch (err) {
    logger.error('seo.getRobots failed:', err.message);
    next(err);
  }
}

async function previewRobots(_req, res, next) {
  try {
    const { value } = await readRow();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(buildRobots(value, 'https://www.moto-scoot.tn'));
  } catch (err) { next(err); }
}

module.exports = { getPublic, getAdmin, update, ga4Report, gscReport, testCredentials, getRobots, previewRobots };
