import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import pg from "pg";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { isKnownPagePath } from "./utils/knownPages";
import listingHtmlHandler from './api/og-listing';
import detailHtmlHandler from './api/og-prerender';

dotenv.config();

const { Pool } = pg;

// =====================================================================
// SSR meta injection for social-media share previews
// =====================================================================
// React renders OG meta client-side via components/common/SEO.tsx. That
// works in browsers but social scrapers (Facebook/WhatsApp/LinkedIn/X/
// Telegram) don't execute JS — they only read the raw HTML. Without
// server-side injection they would always see the default
// homepage banner instead of the listing's title/photo/price.
// We intercept SPA fallback requests for listing-detail URLs, fetch the
// listing from the backend API, and rewrite the OG/Twitter/title tags in
// index.html before sending it.

const API_ORIGIN = (process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || 'https://motoscoot.ihebchebbi.pro/api').replace(/\/+$/, '');
const SITE_NAME = 'MotoScoot.tn';

// Matches /annonce/<slug>-<uuid-or-numeric-id>
const LISTING_URL_RE = /^\/annonce\/[a-z0-9-]+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)\/?$/i;
// Matches /fiche-technique/<slug>-<uuid-or-numeric-id> (legacy long links)
const TECH_SPEC_URL_RE = /^\/fiche-technique\/[a-z0-9-]+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;
// Matches short technical-sheet links: /fiche-technique/sym-jet-14-evo
const TECH_SPEC_SHORT_RE = /^\/fiche-technique\/([a-z0-9-]+)\/?$/i;


const escapeHtml = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatPriceTND = (price: any) => {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' TND';
};

// True only when the data service explicitly answers 404 (an outage must not 404 real pages).
async function apiSaysMissing(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return r.status === 404;
  } catch {
    return false;
  }
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    console.warn('[ssr-meta] fetch failed', url, (e as any)?.message);
    return null;
  }
}

interface MetaInput {
  title: string;       // raw page title (no site suffix)
  description: string; // already-cleaned, will be truncated
  image: string;       // absolute https URL
  url: string;         // absolute canonical URL
  type: 'product' | 'article' | 'website';
  path?: string;       // preferred canonical path, when it differs from the request
}

function injectMeta(html: string, m: MetaInput): string {
  const fullTitle = `${m.title} | ${SITE_NAME}`;
  const description = m.description.slice(0, 200);
  const T = escapeHtml(fullTitle);
  const D = escapeHtml(description);
  const U = escapeHtml(m.url);
  const I = escapeHtml(m.image);
  const isPng = /\.png(\?|$)/i.test(m.image);
  const isWebp = /\.webp(\?|$)/i.test(m.image);
  const mime = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';

  const replacements: Array<[RegExp, string]> = [
    [/<title>[\s\S]*?<\/title>/i, `<title>${T}</title>`],
    [/<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${D}" />`],
    [/<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${T}" />`],
    [/<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${D}" />`],
    [/<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${U}" />`],
    [/<meta\s+property="og:type"[^>]*>/i, `<meta property="og:type" content="${m.type}" />`],
    [/<meta\s+property="og:image"[^>]*>/i, `<meta property="og:image" content="${I}" />`],
    [/<meta\s+property="og:image:secure_url"[^>]*>/i, `<meta property="og:image:secure_url" content="${I}" />`],
    [/<meta\s+property="og:image:type"[^>]*>/i, `<meta property="og:image:type" content="${mime}" />`],
    [/<meta\s+property="og:image:alt"[^>]*>/i, `<meta property="og:image:alt" content="${escapeHtml(m.title)}" />`],
    [/<meta\s+name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${T}" />`],
    [/<meta\s+name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${D}" />`],
    [/<meta\s+name="twitter:image"[^>]*>/i, `<meta name="twitter:image" content="${I}" />`],
    [/<meta\s+name="twitter:image:alt"[^>]*>/i, `<meta name="twitter:image:alt" content="${escapeHtml(m.title)}" />`],
  ];

  let out = html;
  for (const [re, val] of replacements) {
    if (re.test(out)) out = out.replace(re, val);
  }
  if (/<link\s+rel="canonical"[^>]*>/i.test(out)) {
    out = out.replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${U}" />`);
  } else {
    out = out.replace('</head>', `  <link rel="canonical" href="${U}" />\n  </head>`);
  }
  return out;
}

async function fetchListingForMeta(id: string): Promise<MetaInput | null> {
  const listing = await fetchJson(`${API_ORIGIN}/listings/${encodeURIComponent(id)}`);
  if (!listing) return null;
  const brand = listing.brand || '';
  const model = listing.model || '';
  const year = listing.year ? ` (${listing.year})` : '';
  const priceLabel = formatPriceTND(listing.price);
  const title = listing.title || `${brand} ${model}${year}`.trim() || 'Annonce';
  const fullTitle = `${title}${priceLabel ? ` — ${priceLabel}` : ''}`;
  const city = listing.city || listing.governorate || 'Tunisie';
  const descRaw = listing.description
    ? String(listing.description).replace(/\s+/g, ' ').trim()
    : `${brand} ${model}${year} à vendre${priceLabel ? ` pour ${priceLabel}` : ''} à ${city}. Découvrez l'annonce sur ${SITE_NAME}.`;
  const images: string[] = Array.isArray(listing.images) ? listing.images.filter(Boolean) : [];
  const image = images[0] || 'https://www.moto-scoot.tn/og-banner.webp';
  return { title: fullTitle, description: descRaw, image, url: '', type: 'product' };
}

async function fetchTechSpecForMeta(id: string): Promise<MetaInput | null> {
  const spec = await fetchJson(`${API_ORIGIN}/tech-specs/${encodeURIComponent(id)}`);
  if (!spec) return null;
  const brand = spec.brand || '';
  const model = spec.model || '';
  const year = spec.year ? ` ${spec.year}` : '';
  const name = `${brand} ${model}${year}`.trim() || 'Fiche Technique';
  const title = `Fiche Technique ${name}`;
  // Pull a few headline specs for a rich description.
  const bits: string[] = [];
  if (spec.category) bits.push(String(spec.category));
  const cc = spec.engine_cc ?? spec.engine?.cc;
  if (cc) bits.push(`${String(cc).replace(/\s*cc/i, '').trim()} cc`);
  const power = spec.engine_power ?? spec.engine?.power;
  if (power) bits.push(`${power}`);
  const price = spec.price_new;
  if (price && !Number.isNaN(Number(price))) {
    bits.push(`à partir de ${new Intl.NumberFormat('fr-FR').format(Number(price))} DT`);
  } else if (typeof price === 'string' && price.trim()) {
    bits.push(price.trim());
  }
  const description = bits.length
    ? `${name} — ${bits.join(' · ')}. Caractéristiques complètes, photos et prix neuf en Tunisie sur ${SITE_NAME}.`
    : `Découvrez la fiche technique complète du ${name} : caractéristiques, photos et prix neuf en Tunisie sur ${SITE_NAME}.`;
  const gallery: string[] = Array.isArray(spec.gallery) ? spec.gallery.filter(Boolean) : [];
  const image = spec.cover_image || spec.image || gallery[0] || 'https://www.moto-scoot.tn/og-banner.webp';
  // Canonical is always the short link, even when opened via an old long link.
  return { title, description, image, url: '', type: 'product', path: spec.slug ? `/fiche-technique/${spec.slug}` : undefined };
}

function originFromReq(req: express.Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'www.moto-scoot.tn';
  return `${proto}://${host}`;

}



let pool: pg.Pool | null = null;

const getPool = () => {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      // Note: do NOT reset pool to null here — it would cause a new pool to be
      // created on every subsequent request, each with its own connection overhead.
      // The Pool class handles reconnection internally.
    });
  }
  return pool;
};

async function startServer() {
  const app = express();
  // Resolve port: --port CLI arg > PORT env > 8080 (Lovable preview default).
  // Hardcoding 3000 caused the Lovable proxy (which targets 8080) to return 502.
  const argvPortIdx = process.argv.indexOf('--port');
  const argvPort = argvPortIdx !== -1 ? Number(process.argv[argvPortIdx + 1]) : NaN;
  const PORT = Number.isFinite(argvPort) ? argvPort : Number(process.env.PORT) || 8080;

  // CORS: allow ALL origins — no restrictions, no rate limiting.
  app.use(cors({ origin: '*', methods: '*', allowedHeaders: '*', credentials: false }));
  app.use(express.json());

  // Trust proxy still useful for accurate req.ip in logs behind Lovable's edge.
  app.set('trust proxy', 1);

  // Rate limiting intentionally disabled per project policy.

  // API Routes
  // Mirror the vercel.json media rewrites so photos also load on this server.
  const MEDIA_ORIGIN = 'https://motoscoot.ihebchebbi.pro/uploads';
  app.get(['/m/:slug/t/:filename', '/uploads/thumbnails/:filename'], (req, res) =>
    res.redirect(302, `${MEDIA_ORIGIN}/thumbnails/${encodeURIComponent(String(req.params.filename))}`));
  app.get(['/m/:slug/:filename', '/uploads/:filename'], (req, res) =>
    res.redirect(302, `${MEDIA_ORIGIN}/${encodeURIComponent(String(req.params.filename))}`));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Track a brand visit
  app.post("/api/brands/visit", async (req, res) => {
    const { brand } = req.body;
    if (!brand) return res.status(400).json({ error: "Brand is required" });
    
    try {
      const dbPool = getPool();
      if (dbPool) {
        await dbPool.query(
          `INSERT INTO brand_visits (brand, visits) 
           VALUES ($1, 1) 
           ON CONFLICT (brand) 
           DO UPDATE SET visits = brand_visits.visits + 1`,
          [brand]
        );
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking brand visit:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get popular brands across the community
  app.get("/api/brands/popular", async (req, res) => {
    try {
      const dbPool = getPool();
      if (dbPool) {
        // Only return brands that still exist in tech_specs — otherwise
        // a brand removed by the admin keeps appearing in the "popular"
        // grid until brand_visits is manually cleaned up.
        const result = await dbPool.query(
          `SELECT bv.brand
             FROM brand_visits bv
            WHERE EXISTS (
              SELECT 1 FROM tech_specs ts
               WHERE LOWER(ts.brand) = LOWER(bv.brand)
            )
            ORDER BY bv.visits DESC
            LIMIT 6`
        );
        const brands = result.rows.map(row => row.brand);
        res.json({ brands });
      } else {
        // Fallback if DB not connected yet
        res.json({ brands: [] });
      }
    } catch (error) {
      console.error("Error fetching popular brands:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  const vite = process.env.NODE_ENV !== 'production' ? await createViteServer({ server: { middlewareMode: true }, appType: 'spa' }) : null;
  app.get('/sitemap-dynamic.xml', async (_req, res) => {
    try {
      const response = await fetch(`${API_ORIGIN}/sitemap.xml`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) return res.status(503).send('Sitemap unavailable');
      const xml = await response.text();
      if (!xml.includes('<urlset') && !xml.includes('<sitemapindex')) return res.status(503).send('Invalid sitemap response');
      res.type('application/xml').send(xml);
    } catch { res.status(503).send('Sitemap unavailable'); }
  });
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const match = req.path.match(/^\/(annonce|article|guide|garage|fiche-technique)\/([^/]+)\/?$/);
    if (match) {
      try {
        const shellPath = process.env.NODE_ENV === 'production' ? path.join(process.cwd(), 'dist', 'spa.html') : path.join(process.cwd(), 'index.html');
        let shell = fs.readFileSync(shellPath, 'utf8');
        if (vite) shell = await vite.transformIndexHtml(req.originalUrl, shell);
        const input = { query: { kind: match[1], slugid: match[2] }, appShell: shell };
        return await (match[1] === 'annonce' ? listingHtmlHandler : detailHtmlHandler)(input, res);
      } catch { return res.status(503).setHeader('Cache-Control', 'no-store').send('Page temporairement indisponible'); }
    }
    // Assets/API routes are handled separately; only actual page addresses use the SPA.
    const asset = /\.[a-z0-9]+$/i.test(req.path) || /^\/(?:@|src\/|node_modules\/|assets\/|api\/|uploads\/|m\/|hero-assets\/|brand-logos\/|site-logo\/|content-fallbacks\/)/.test(req.path);
    if (!asset && !isKnownPagePath(req.path)) {
      return res.status(404).setHeader('X-Robots-Tag', 'noindex').send(fs.readFileSync(path.join(process.cwd(), 'public', '404.html'), 'utf8'));
    }
    next();
  });
  if (process.env.NODE_ENV !== "production") {
    if (vite) app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const indexPath = path.join(distPath, 'index.html');
    // Generic page without the homepage canonical (same as vercel.json).
    const spaPath = fs.existsSync(path.join(distPath, 'spa.html')) ? path.join(distPath, 'spa.html') : indexPath;

    // Mirror the vercel.json sitemap rewrite on this server.
    app.get('/sitemap-dynamic.xml', async (_req, res) => {
      try {
        const r = await fetch(`${API_ORIGIN}/sitemap.xml`, { signal: AbortSignal.timeout(10000) });
        if (!r.ok) return res.status(502).send('Sitemap unavailable');
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.send(await r.text());
      } catch {
        res.status(502).send('Sitemap unavailable');
      }
    });

    // Serve hashed assets etc. directly. `index: false` + `redirect: false`
    // keep "/comparateur" (no trailing slash, like Vercel) on the fallback below.
    app.use(express.static(distPath, { index: false, redirect: false }));

    app.get('*all', async (req, res) => {
      try {
        // Prerendered section pages carry their own canonical; everything else
        // uses the generic page (no homepage canonical).
        const clean = req.path.replace(/\/+$/, '');
        const snapshot = clean && !clean.includes('..') ? path.join(distPath, clean, 'index.html') : '';
        const basePath = req.path === '/' ? indexPath : (snapshot && fs.existsSync(snapshot) ? snapshot : spaPath);
        let html = fs.readFileSync(basePath, 'utf-8');
        const fullUrl = `${originFromReq(req)}${req.originalUrl}`;

        if (!isKnownPagePath(req.path)) {
          const notFound = path.join(distPath, '404.html');
          res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8');
          if (fs.existsSync(notFound)) return res.send(fs.readFileSync(notFound, 'utf-8'));
          return res.send('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Page introuvable | MotoScoot</title></head><body><h1>Page introuvable</h1><p><a href="/">Retour à l\'accueil</a></p></body></html>');
        }

        const listingMatch = req.path.match(LISTING_URL_RE);
        const techSpecMatch = req.path.match(TECH_SPEC_URL_RE) || req.path.match(TECH_SPEC_SHORT_RE);

        let meta: MetaInput | null = null;
        if (listingMatch) {
          meta = await fetchListingForMeta(listingMatch[1]);
        } else if (techSpecMatch) {
          meta = await fetchTechSpecForMeta(techSpecMatch[1]);
        }
        if (meta) {
          html = injectMeta(html, { ...meta, url: meta.path ? `${originFromReq(req)}${meta.path}` : fullUrl });
        } else if ((listingMatch || techSpecMatch) && await apiSaysMissing(
          listingMatch ? `${API_ORIGIN}/listings/${encodeURIComponent(listingMatch[1])}`
                       : `${API_ORIGIN}/tech-specs/${encodeURIComponent(techSpecMatch?.[1] || '')}`)) {
          // Unknown listing / sheet: real 404, noindex, no homepage canonical.
          html = html
            .replace(/<link\s+rel="canonical"[^>]*>/i, '')
            .replace('</head>', '  <meta name="robots" content="noindex" />\n  </head>');
          res.status(404);
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
      } catch (err) {
        console.error('[ssr-meta] fallback failed', err);
        res.sendFile(indexPath);
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
