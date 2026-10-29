const router = require('express').Router();
const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * GET /api/sitemap.xml
 *
 * Dynamic sitemap aggregating every public, indexable URL from the database:
 * static routes + active listings + published articles + tips + garages +
 * tech-specs. Cached in-memory for SITEMAP_TTL_MS so we don't hammer the DB
 * on every crawler hit (Googlebot can request this many times per day).
 *
 * The frontend's static `public/sitemap.xml` covers the marketing routes as
 * a fallback; this dynamic one is what surfaces individual content URLs.
 *
 * Response is `application/xml`. Errors degrade gracefully — if any single
 * collection query fails we still emit the rest so partial outages don't
 * blank the entire sitemap.
 */
const SITE_ORIGIN = process.env.PUBLIC_SITE_ORIGIN || 'https://www.moto-scoot.tn';
const SITEMAP_TTL_MS = 60 * 60 * 1000; // 1 hour

let _cache = { xml: null, at: 0 };

function slugify(text) {
  if (!text) return 'details';
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

function urlEntry({ loc, lastmod, changefreq = 'weekly', priority = 0.5 }) {
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    lastmod ? `    <lastmod>${new Date(lastmod).toISOString()}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].filter(Boolean).join('\n');
}

async function buildSitemap() {
  const now = Date.now();
  if (_cache.xml && now - _cache.at < SITEMAP_TTL_MS) return _cache.xml;

  const safe = (sql, params, fallback = []) =>
    query(sql, params).then(r => r.rows).catch((err) => {
      logger.warn(`[sitemap] query failed: ${err.message}`);
      return fallback;
    });

  // Run every collection in parallel; each failure degrades that section only.
  const [listings, articles, tips, garages, techSpecs] = await Promise.all([
    safe(
      // to_jsonb(...)->> keeps the sitemap working before/after the short-number migration.
      `SELECT id, to_jsonb(l)->>'listing_number' AS listing_number, title, COALESCE(updated_at, created_at) AS lastmod
         FROM listings l
        WHERE status = 'active' OR status IS NULL
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT 5000`,
      []
    ),
    safe(
      `SELECT id, title, COALESCE(updated_at, created_at, published_at) AS lastmod
         FROM articles
        WHERE COALESCE(is_published, true) = true
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT 2000`,
      []
    ),
    safe(
      `SELECT id, title, COALESCE(updated_at, created_at) AS lastmod
         FROM tips
        WHERE COALESCE(is_published, true) = true
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT 2000`,
      []
    ),
    safe(
      `SELECT id, name, COALESCE(updated_at, created_at) AS lastmod
         FROM garages
        WHERE COALESCE(is_active, true) = true
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT 2000`,
      []
    ),
    safe(
      `SELECT id, to_jsonb(t)->>'slug' AS slug, COALESCE(model, brand) AS title, brand,
              COALESCE(updated_at, created_at) AS lastmod
         FROM tech_specs t
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT 5000`,
      []
    ),
  ]);

  const entries = [];

  // Static / marketing
  const staticRoutes = [
    { path: '/',                    changefreq: 'daily',   priority: 1.0 },
    { path: '/annonces',            changefreq: 'hourly',  priority: 0.95 },
    { path: '/garages',             changefreq: 'daily',   priority: 0.9 },
    { path: '/actualites',          changefreq: 'daily',   priority: 0.85 },
    { path: '/conseils',            changefreq: 'weekly',  priority: 0.8 },
    { path: '/fiches-techniques',   changefreq: 'weekly',  priority: 0.8 },
    { path: '/comparateur',         changefreq: 'weekly',  priority: 0.7 },
    { path: '/a-propos',            changefreq: 'monthly', priority: 0.6 },
    { path: '/contact',             changefreq: 'monthly', priority: 0.6 },
    { path: '/faq',                 changefreq: 'monthly', priority: 0.6 },
    { path: '/securite',            changefreq: 'monthly', priority: 0.5 },
    { path: '/mentions-legales',    changefreq: 'yearly',  priority: 0.3 },
    { path: '/conditions',          changefreq: 'yearly',  priority: 0.3 },
    { path: '/cookies',             changefreq: 'yearly',  priority: 0.3 },
  ];
  for (const r of staticRoutes) {
    entries.push(urlEntry({ loc: `${SITE_ORIGIN}${r.path}`, changefreq: r.changefreq, priority: r.priority }));
  }

  for (const l of listings) {
    entries.push(urlEntry({
      loc: `${SITE_ORIGIN}/annonce/${slugify(l.title)}-${l.listing_number ?? l.id}`,
      lastmod: l.lastmod,
      changefreq: 'daily',
      priority: 0.8,
    }));
  }
  for (const a of articles) {
    entries.push(urlEntry({
      loc: `${SITE_ORIGIN}/article/${slugify(a.title)}-${a.id}`,
      lastmod: a.lastmod,
      changefreq: 'monthly',
      priority: 0.7,
    }));
  }
  // Guides are temporarily excluded (customer request, audit item 05) until
  // every guide detail page is confirmed to load for crawlers.
  if (process.env.SITEMAP_INCLUDE_GUIDES === '1') for (const t of tips) {
    entries.push(urlEntry({
      loc: `${SITE_ORIGIN}/guide/${slugify(t.title)}-${t.id}`,
      lastmod: t.lastmod,
      changefreq: 'monthly',
      priority: 0.6,
    }));
  }
  for (const g of garages) {
    entries.push(urlEntry({
      loc: `${SITE_ORIGIN}/garage/${slugify(g.name)}-${g.id}`,
      lastmod: g.lastmod,
      changefreq: 'weekly',
      priority: 0.7,
    }));
  }
  for (const ts of techSpecs) {
    entries.push(urlEntry({
      loc: `${SITE_ORIGIN}/fiche-technique/${ts.slug || `${slugify(ts.title)}-${ts.id}`}`,
      lastmod: ts.lastmod,
      changefreq: 'monthly',
      priority: 0.65,
    }));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

  _cache = { xml, at: now };
  return xml;
}

router.get('/sitemap.xml', async (_req, res, next) => {
  try {
    const xml = await buildSitemap();
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.send(xml);
  } catch (err) { next(err); }
});

module.exports = router;
