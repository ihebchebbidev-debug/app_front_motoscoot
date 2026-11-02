const router = require('express').Router();
const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * GET /api/sitemap.xml          every URL in one file
 * GET /api/sitemap-<type>.xml   one content type: pages, annonces, articles,
 *                               guides, marques, fiches, garages
 *
 * Dynamic sitemap aggregating every public, indexable URL from the database:
 * static routes + active listings + published articles + tips + tech-spec
 * brand pages + tech-specs (garages only with SITEMAP_INCLUDE_GARAGES=1).
 * Cached in-memory for SITEMAP_TTL_MS so we don't hammer the DB
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

let _cache = { groups: null, at: 0 };

// One sitemap per content type (/api/sitemap-<type>.xml) so Search Console
// reports indexing per type; /api/sitemap.xml keeps every URL in one file.
const SITEMAP_TYPES = ['pages', 'annonces', 'articles', 'guides', 'marques', 'fiches', 'garages'];

// Articles and guides under this many words are served "noindex, follow"
// by the front end (utils/editorial.ts, same threshold): keep them out.
const THIN_CONTENT_WORDS = 300;
const wordCount = (html) =>
  (String(html || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').match(/[\p{L}\p{N}]+/gu) || []).length;
const indexable = (row) => wordCount(row.content) >= THIN_CONTENT_WORDS;

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

// Same normalisation as the prerender (api/og-prerender.ts), which owns the
// canonical URL of articles, guides and brand pages: no leading/trailing dash,
// ASCII letters and digits only. Anything else would 301 to the canonical.
function canonicalSlug(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '');
}

// Most recent date of a collection, for the lastmod of its listing page.
function latest(rows) {
  const times = rows.map(r => new Date(r.lastmod).getTime()).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)) : undefined;
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

async function buildGroups() {
  const now = Date.now();
  if (_cache.groups && now - _cache.at < SITEMAP_TTL_MS) return _cache.groups;

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
      `SELECT id, title, content, COALESCE(updated_at, created_at, published_at) AS lastmod
         FROM articles
        WHERE COALESCE(is_published, true) = true
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT 2000`,
      []
    ),
    safe(
      `SELECT id, title, content, COALESCE(updated_at, created_at) AS lastmod
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

  const groups = Object.fromEntries(SITEMAP_TYPES.map(type => [type, []]));

  // Static / marketing
  const staticRoutes = [
    { path: '/',                    changefreq: 'daily',   priority: 1.0,  lastmod: latest([...listings, ...articles, ...tips, ...techSpecs]) },
    { path: '/annonces',            changefreq: 'hourly',  priority: 0.95, lastmod: latest(listings) },
    { path: '/actualites',          changefreq: 'daily',   priority: 0.85, lastmod: latest(articles) },
    { path: '/conseils',            changefreq: 'weekly',  priority: 0.8,  lastmod: latest(tips) },
    { path: '/fiches-techniques',   changefreq: 'weekly',  priority: 0.8,  lastmod: latest(techSpecs) },
    { path: '/comparateur',         changefreq: 'weekly',  priority: 0.7,  lastmod: latest(techSpecs) },
    { path: '/a-propos',            changefreq: 'monthly', priority: 0.6 },
    { path: '/contact',             changefreq: 'monthly', priority: 0.6 },
    { path: '/faq',                 changefreq: 'monthly', priority: 0.6 },
    { path: '/securite',            changefreq: 'monthly', priority: 0.5 },
    { path: '/mentions-legales',    changefreq: 'yearly',  priority: 0.3 },
    { path: '/conditions',          changefreq: 'yearly',  priority: 0.3 },
    { path: '/cookies',             changefreq: 'yearly',  priority: 0.3 },
  ];
  // Garages are noindex while the directory only holds demo data (audit C3);
  // set SITEMAP_INCLUDE_GARAGES=1 once real garages are listed.
  const includeGarages = process.env.SITEMAP_INCLUDE_GARAGES === '1';
  if (includeGarages) groups.garages.push(urlEntry({ loc: `${SITE_ORIGIN}/garages`, lastmod: latest(garages), changefreq: 'daily', priority: 0.9 }));
  for (const r of staticRoutes) {
    groups.pages.push(urlEntry({ loc: `${SITE_ORIGIN}${r.path}`, lastmod: r.lastmod, changefreq: r.changefreq, priority: r.priority }));
  }

  for (const l of listings) {
    groups.annonces.push(urlEntry({
      loc: `${SITE_ORIGIN}/annonce/${slugify(l.title)}-${l.listing_number ?? l.id}`,
      lastmod: l.lastmod,
      changefreq: 'daily',
      priority: 0.8,
    }));
  }
  for (const a of articles.filter(indexable)) {
    groups.articles.push(urlEntry({
      loc: `${SITE_ORIGIN}/article/${canonicalSlug(a.title)}-${a.id}`,
      lastmod: a.lastmod,
      changefreq: 'monthly',
      priority: 0.7,
    }));
  }
  // Guides are included now that every guide page loads for crawlers (SEO
  // audit E1, 2026-11); SITEMAP_INCLUDE_GUIDES=0 excludes them again.
  if (process.env.SITEMAP_INCLUDE_GUIDES !== '0') for (const t of tips.filter(indexable)) {
    groups.guides.push(urlEntry({
      loc: `${SITE_ORIGIN}/guide/${canonicalSlug(t.title)}-${t.id}`,
      lastmod: t.lastmod,
      changefreq: 'monthly',
      priority: 0.6,
    }));
  }
  if (includeGarages) for (const g of garages) {
    groups.garages.push(urlEntry({
      loc: `${SITE_ORIGIN}/garage/${slugify(g.name)}-${g.id}`,
      lastmod: g.lastmod,
      changefreq: 'weekly',
      priority: 0.7,
    }));
  }
  // Brand pages (/fiches-techniques/<marque>): one per brand that has specs,
  // dated by its most recently updated spec.
  const brands = new Map();
  for (const ts of techSpecs) {
    if (!ts.brand) continue;
    const slug = canonicalSlug(ts.brand);
    if (slug) brands.set(slug, [...(brands.get(slug) || []), ts]);
  }
  for (const [slug, specs] of brands) {
    groups.marques.push(urlEntry({
      loc: `${SITE_ORIGIN}/fiches-techniques/${slug}`,
      lastmod: latest(specs),
      changefreq: 'weekly',
      priority: 0.75,
    }));
  }
  for (const ts of techSpecs) {
    groups.fiches.push(urlEntry({
      loc: `${SITE_ORIGIN}/fiche-technique/${ts.slug || `${slugify(ts.title)}-${ts.id}`}`,
      lastmod: ts.lastmod,
      changefreq: 'monthly',
      priority: 0.65,
    }));
  }

  _cache = { groups, at: now };
  return groups;
}

// `type` = one of SITEMAP_TYPES, or undefined for every URL.
async function buildSitemap(type) {
  const groups = await buildGroups();
  const entries = type ? groups[type] : SITEMAP_TYPES.flatMap(t => groups[t]);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;
}

const sendSitemap = (type) => async (_req, res, next) => {
  try {
    const xml = await buildSitemap(type);
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.send(xml);
  } catch (err) { next(err); }
};

router.get('/sitemap.xml', sendSitemap());
for (const type of SITEMAP_TYPES) router.get(`/sitemap-${type}.xml`, sendSitemap(type));

module.exports = router;
