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

// Detail pages (/annonce, /article, /guide, /garage, /fiche-technique,
// /fiches-techniques, /prix) are rendered by the same handlers as on Vercel
// (api/og-listing.ts, api/og-prerender.ts): see the middleware in
// startServer(). Other pages are served as built (snapshots or spa.html).

const API_ORIGIN = (process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || 'https://motoscoot.ihebchebbi.pro/api').replace(/\/+$/, '');



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
  // Mirrors the vercel.json sitemap rewrites: /sitemap-dynamic.xml -> /api/sitemap.xml,
  // /sitemap-<type>.xml -> /api/sitemap-<type>.xml.
  app.get(/^\/sitemap-(dynamic|pages|annonces|articles|guides|marques|fiches|garages)\.xml$/, async (req, res) => {
    try {
      const type = req.path.slice('/sitemap-'.length, -'.xml'.length);
      const response = await fetch(`${API_ORIGIN}/${type === 'dynamic' ? 'sitemap.xml' : `sitemap-${type}.xml`}`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) return res.status(503).send('Sitemap unavailable');
      const xml = await response.text();
      if (!xml.includes('<urlset') && !xml.includes('<sitemapindex')) return res.status(503).send('Invalid sitemap response');
      res.type('application/xml').send(xml);
    } catch { res.status(503).send('Sitemap unavailable'); }
  });
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const match = req.path.match(/^\/(annonce|article|guide|garage|fiche-technique|fiches-techniques|prix)\/([^/]+)\/?$/);
    if (match) {
      try {
        const shellPath = process.env.NODE_ENV === 'production' ? path.join(process.cwd(), 'dist', 'spa.html') : path.join(process.cwd(), 'index.html');
        let shell = fs.readFileSync(shellPath, 'utf8');
        if (vite) shell = await vite.transformIndexHtml(req.originalUrl, shell);
        const input = { query: { kind: match[1] === 'fiches-techniques' ? 'marque' : match[1], slugid: match[2] }, appShell: shell };
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
        const html = fs.readFileSync(basePath, 'utf-8');
        if (!isKnownPagePath(req.path)) {
          const notFound = path.join(distPath, '404.html');
          res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8');
          if (fs.existsSync(notFound)) return res.send(fs.readFileSync(notFound, 'utf-8'));
          return res.send('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Page introuvable | Moto-Scoot.tn</title></head><body><h1>Page introuvable</h1><p><a href="/">Retour à l\'accueil</a></p></body></html>');
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
