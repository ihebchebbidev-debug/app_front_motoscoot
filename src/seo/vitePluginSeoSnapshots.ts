/**
 * Custom Vite plugin: at the end of `vite build`, walk SEO_SNAPSHOTS and emit
 * one HTML file per route — each one is a copy of dist/index.html with route-
 * specific <title>, <meta>, <link rel="canonical">, OG/Twitter tags, JSON-LD
 * and a <noscript>/SSR-fallback H1+intro stamped in.
 *
 * No puppeteer / no headless browser — we don't need to render React, just to
 * give crawlers and LLMs route-specific HTML. The React app still hydrates on
 * top and serves the dynamic, interactive UI to real users.
 *
 * Hosting layer (Vercel SPA fallback / Cloudflare Pages) serves the matching
 * file from /<route>/index.html when the URL is requested directly. Every
 * other URL still falls back to /index.html (the default SPA shell).
 */
import type { Plugin } from 'vite';
import path from 'node:path';
import fs from 'node:fs/promises';
import { SEO_SNAPSHOTS, SITE_ORIGIN, DEFAULT_OG, type SeoSnapshot } from './snapshots';
import { HERO_DEFAULTS } from '../../config/heroDefaults';
import { SPA_TITLE, SPA_DESCRIPTION, DEPOSIT_TITLE, DEPOSIT_DESCRIPTION } from './privatePages';
import { linkBlocksFor, renderLinkBlocks, MAX_LISTING_LINKS, type SnapshotListing, type SnapshotEditorial } from './snapshotLinks';

interface HeroImages { desktop_url: string; mobile_url: string; background_color: string }

// Admin hero images, read once at build time so the home page preloads and
// paints the image the app will show. It used to preload the defaults while
// the app displayed the admin upload: a wasted download and a late LCP
// (PageSpeed: 660 ms resource load delay). Defaults when the API is down.
const HERO_API = 'https://motoscoot.ihebchebbi.pro/api/site-settings/hero';
async function fetchHeroImages(): Promise<{ hero: HeroImages; raw: unknown | null }> {
  try {
    const res = await fetch(HERO_API, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(String(res.status));
    const raw = await res.json();
    return {
      raw,
      hero: {
        desktop_url: raw?.desktop_url || HERO_DEFAULTS.desktop_url,
        mobile_url: raw?.mobile_url || HERO_DEFAULTS.mobile_url,
        background_color: raw?.background_color || HERO_DEFAULTS.background_color,
      },
    };
  } catch {
    return { raw: null, hero: { ...HERO_DEFAULTS } };
  }
}

// Brands that have technical sheets, read once at build time for the link
// lists of the entry pages (see snapshotLinks.ts). No brand links when the
// API is down: the pages still build, with their section links.
const BRANDS_API = 'https://motoscoot.ihebchebbi.pro/api/tech-specs/brands';
async function fetchBrands(): Promise<string[]> {
  try {
    const res = await fetch(BRANDS_API, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const rows: unknown[] = Array.isArray(data) ? data : data?.brands || [];
    return rows.map((b: any) => String(typeof b === 'string' ? b : b?.brand || b?.name || '')).filter(Boolean);
  } catch {
    return [];
  }
}

// Listings online at build time, newest first, for /annonces (step 2). A
// listing posted after the build reaches this HTML at the next deploy; the
// sitemap gives it to Google within the hour meanwhile.
const LISTINGS_API = 'https://motoscoot.ihebchebbi.pro/api/listings';
async function fetchListings(): Promise<SnapshotListing[]> {
  const out: SnapshotListing[] = [];
  try {
    for (let page = 1; page <= 5 && out.length < MAX_LISTING_LINKS; page++) {
      const res = await fetch(`${LISTINGS_API}?limit=100&page=${page}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const rows: SnapshotListing[] = Array.isArray(data) ? data : data?.listings || [];
      out.push(...rows);
      const totalPages = Number(data?.pagination?.totalPages || 1);
      if (!rows.length || page >= totalPages) break;
    }
    return out;
  } catch {
    return out;
  }
}

// Articles and guides at build time, for /actualites and /conseils (step 3).
// Same lists the pages show; the thin ones are filtered in snapshotLinks.ts.
async function fetchEditorial(endpoint: 'articles' | 'tips'): Promise<SnapshotEditorial[]> {
  const out: SnapshotEditorial[] = [];
  try {
    for (let page = 1; page <= 5; page++) {
      const res = await fetch(`https://motoscoot.ihebchebbi.pro/api/${endpoint}?page=${page}&limit=100`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const rows: SnapshotEditorial[] = Array.isArray(data) ? data : data?.[endpoint] || [];
      out.push(...rows);
      const totalPages = Number(data?.pagination?.totalPages || 1);
      if (!rows.length || page >= totalPages) break;
    }
    return out;
  } catch {
    return out;
  }
}

export interface SnapshotData { brands: string[]; listings: SnapshotListing[]; articles: SnapshotEditorial[]; guides: SnapshotEditorial[] }

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function renderHead(snap: SeoSnapshot): string {
  const ogImage = snap.ogImage || DEFAULT_OG;
  const canonical = `${SITE_ORIGIN}${snap.path === '/' ? '/' : snap.path}`;
  const schemaJson = snap.schemas && snap.schemas.length
    // data-ssr-ld: SEO.tsx keeps these on the landing page instead of adding
    // its own (/faq had two FAQPage blocks with different answers).
    ? `<script type="application/ld+json" data-ssr-ld>${JSON.stringify(snap.schemas.length === 1 ? snap.schemas[0] : snap.schemas)}</script>`
    : '';

  return `
    <title>${escapeHtml(snap.title)}</title>
    <meta name="description" content="${escapeHtml(snap.description)}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="alternate" href="${canonical}" hreflang="fr-TN" />
    <link rel="alternate" href="${canonical}" hreflang="x-default" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Moto-Scoot.tn" />
    <meta property="og:locale" content="fr_TN" />
    <meta property="og:title" content="${escapeHtml(snap.title)}" />
    <meta property="og:description" content="${escapeHtml(snap.description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(ogImage)}" />
    <meta property="og:image:type" content="image/webp" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(snap.title)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@motoscoot_tn" />
    <meta name="twitter:title" content="${escapeHtml(snap.title)}" />
    <meta name="twitter:description" content="${escapeHtml(snap.description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(snap.title)}" />
    ${schemaJson}
  `;
}

// Static first-paint shell for the home page (PageSpeed FCP/LCP): the header
// bar + hero photo paint straight from HTML, before the JS bundle runs.
// React.createRoot replaces it on mount. Inline styles only — no CSS needed.
function renderHomeShell(hero: HeroImages): string {
  return `
    <div data-home-shell aria-hidden="true" style="position:relative;background:${escapeHtml(hero.background_color)}">
      <div style="position:absolute;top:0;left:0;right:0;z-index:2;height:64px;display:flex;align-items:center;padding:0 16px">
        <img src="https://www.moto-scoot.tn/site-logo/logo-white.svg" alt="" width="120" height="28" style="height:28px;width:auto" onerror="this.style.display='none'" />
      </div>
      <picture>
        <source media="(min-width: 768px)" srcset="${escapeHtml(hero.desktop_url)}" />
        <img src="${escapeHtml(hero.mobile_url)}" alt="" fetchpriority="high" decoding="async" style="display:block;width:100%;height:min(88vh,720px);object-fit:cover" />
      </picture>
    </div>`;
}

function renderFallback(snap: SeoSnapshot, hero: HeroImages, data: SnapshotData): string {
  // SSR fallback content visible to non-JS crawlers / LLM training bots.
  // React hydration replaces this on mount, so end users never see it.
  return `${snap.path === '/' ? renderHomeShell(hero) : ''}
    <noscript>
      <style>.__seo_fallback{font-family:Inter,system-ui,sans-serif;max-width:780px;margin:48px auto;padding:0 24px;line-height:1.6;color:#111}</style>
    </noscript>
    <div class="__seo_fallback" data-seo-fallback>
      <h1>${escapeHtml(snap.h1)}</h1>
      <p>${escapeHtml(snap.intro)}</p>
      <p><a href="/">Retour à l'accueil Moto-Scoot.tn</a></p>
      ${renderLinkBlocks(linkBlocksFor(snap.path, data))}
    </div>
  `;
}

function injectIntoIndex(indexHtml: string, snap: SeoSnapshot, hero: HeroImages, heroRaw: unknown | null, data: SnapshotData): string {
  // Replace baseline <title> + <meta description> + canonical with route-
  // specific values, then append the rest of the per-route head block.
  let html = indexHtml;

  // Strip the baseline title/desc/canonical/og/twitter so we don't duplicate.
  html = html.replace(/<title>[\s\S]*?<\/title>/i, '');
  html = html.replace(/<meta\s+name="description"[^>]*>/gi, '');
  html = html.replace(/<meta\s+name="keywords"[^>]*>/gi, '');
  html = html.replace(/<link\s+rel="canonical"[^>]*>/gi, '');
  html = html.replace(/<link\s+rel="alternate"[^>]*hreflang="[^"]*"[^>]*>/gi, '');
  html = html.replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, '');
  html = html.replace(/<meta\s+name="twitter:[^"]+"[^>]*>/gi, '');
  html = html.replace(/\sdata-pre-hydrate/g, '');
  if (snap.path !== '/') html = html.replace(/<link[^>]+rel="preload"[^>]+as="image"[^>]*>/gi, '');
  if (snap.path === '/') {
    // Preload the hero the app will actually show, and hand it to the app
    // (useHeroImages initialData) so React does not swap images on mount.
    html = html.replace(/(<link[^>]+rel="preload"[^>]+as="image"[^>]+href=")[^"]*("[^>]*media="\(min-width: 768px\)")/, `$1${escapeHtml(hero.desktop_url)}$2`);
    html = html.replace(/(<link[^>]+rel="preload"[^>]+as="image"[^>]+href=")[^"]*("[^>]*media="\(max-width: 767px\)")/, `$1${escapeHtml(hero.mobile_url)}$2`);
    if (heroRaw) {
      const json = JSON.stringify(heroRaw).replace(/</g, '\\u003c');
      html = html.replace('</head>', `<script>window.__HERO_IMAGES__=${json}</script>\n  </head>`);
    }
  }

  if (snap.robots) {
    const robots = escapeHtml(snap.robots);
    html = html.replace(/<meta\s+name="robots"[^>]*>/gi, `<meta name="robots" content="${robots}" />`);
    html = html.replace(/<meta\s+name="googlebot"[^>]*>/gi, `<meta name="googlebot" content="${robots}" />`);
  }

  // Inject our route-specific head right before </head>.
  html = html.replace('</head>', `${renderHead(snap)}\n  </head>`);

  // Inject SSR fallback content inside the empty #root so crawlers see real
  // text. React.createRoot will replace it on hydration. We only do this for
  // the noscript fallback; the original <noscript> in index.html is left
  // alone (it's already inside #root and we just enrich it).
  html = html.replace(
    /<div id="root">[\s\S]*?<\/div>/,
    `<div id="root">${renderFallback(snap, hero, data)}</div>`,
  );

  return html;
}

/**
 * Shell of the private app pages Vercel rewrites to /spa.html (favoris, mon
 * compte, espace pro, admin, mot de passe…) and of « Déposer une annonce ».
 * They used to send the home page's title, description and « index, follow »
 * (SEO audit 2026-11-12: /deposer-une-annonce read as a copy of the home page).
 * Now: their own title, « noindex, follow », no googlebot line, no canonical.
 *
 * The detail pages (fiche, annonce, article…) are built on /spa.html too
 * (utils/detailHtml.ts mergeDetailShell): it strips this title, description
 * and robots line and puts the page's own, so they stay indexable.
 */
export function privateShell(indexHtml: string, title: string, description: string): string {
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return indexHtml
    .replace(/\sdata-pre-hydrate/g, '')
    .replace(/<link[^>]+rel="preload"[^>]+as="image"[^>]*>/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
    .replace(/<link\s+rel="alternate"[^>]*hreflang="[^"]*"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:url"[^>]*>/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${esc(description)}" />`)
    .replace(/<meta\s+property="og:title"[^>]*>/gi, `<meta property="og:title" content="${esc(title)}" />`)
    .replace(/<meta\s+property="og:description"[^>]*>/gi, `<meta property="og:description" content="${esc(description)}" />`)
    .replace(/<meta\s+name="twitter:title"[^>]*>/gi, `<meta name="twitter:title" content="${esc(title)}" />`)
    .replace(/<meta\s+name="twitter:description"[^>]*>/gi, `<meta name="twitter:description" content="${esc(description)}" />`)
    .replace(/<meta\s+name="googlebot"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="robots"[^>]*>/i, '<meta name="robots" content="noindex, follow" />');
}

export function seoSnapshotsPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'motoscoot-seo-snapshots',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir || 'dist';
    },
    async closeBundle() {
      const indexPath = path.resolve(outDir, 'index.html');
      const SPA_SHELL = path.resolve(outDir, 'spa.html');
      let baseHtml: string;
      try {
        baseHtml = await fs.readFile(indexPath, 'utf-8');
      } catch (err) {
        // No index.html in the output (e.g. SSR-only build) — nothing to do.
        this.warn?.(`[seo-snapshots] no ${indexPath} found, skipping`);
        return;
      }

      // Generic SPA shell for dynamic routes (listing, article, sheet…):
      // no canonical / hreflang so a detail URL never claims to be the home
      // page. Vercel rewrites the whitelisted dynamic routes to /spa.html.
      const shell = privateShell(baseHtml, SPA_TITLE, SPA_DESCRIPTION);
      await fs.writeFile(SPA_SHELL, shell, 'utf-8');
      // « Déposer une annonce »: its own title and description, out of Google
      // (a form, not a page to find). Served before the /spa.html rewrite.
      await fs.mkdir(path.resolve(outDir, 'deposer-une-annonce'), { recursive: true });
      await fs.writeFile(
        path.resolve(outDir, 'deposer-une-annonce', 'index.html'),
        privateShell(baseHtml, DEPOSIT_TITLE, DEPOSIT_DESCRIPTION),
        'utf-8',
      );

      const { hero, raw: heroRaw } = await fetchHeroImages();
      // eslint-disable-next-line no-console
      console.log(`[seo-snapshots] hero images: ${heroRaw ? 'admin settings' : 'defaults (API unavailable)'}`);

      const [brands, listings, articles, guides] = await Promise.all([fetchBrands(), fetchListings(), fetchEditorial('articles'), fetchEditorial('tips')]);
      const data: SnapshotData = { brands, listings, articles, guides };
      // eslint-disable-next-line no-console
      console.log(`[seo-snapshots] link lists: ${brands.length} brands, ${listings.length} listings, ${articles.length} articles, ${guides.length} guides`);

      let written = 0;
      for (const snap of SEO_SNAPSHOTS) {
        // Root snapshot REPLACES dist/index.html so the homepage gets the full
        // home metadata. Every other route writes to <outDir>/<path>/index.html
        // so SPA hosts (Vercel, Netlify, Cloudflare Pages) serve the
        // pre-stamped HTML when a deep URL is requested directly.
        const html = injectIntoIndex(baseHtml, snap, hero, heroRaw, data);
        const target =
          snap.path === '/'
            ? path.resolve(outDir, 'index.html')
            : path.resolve(outDir, snap.path.replace(/^\/+/, ''), 'index.html');
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, html, 'utf-8');
        written++;
      }
      // eslint-disable-next-line no-console
      console.log(`\n[seo-snapshots] wrote ${written} prerendered HTML files for crawlers + LLMs.`);
    },
  };
}
