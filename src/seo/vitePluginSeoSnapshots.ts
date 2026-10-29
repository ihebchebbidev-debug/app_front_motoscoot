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

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function renderHead(snap: SeoSnapshot): string {
  const ogImage = snap.ogImage || DEFAULT_OG;
  const canonical = `${SITE_ORIGIN}${snap.path === '/' ? '/' : snap.path}`;
  const schemaJson = snap.schemas && snap.schemas.length
    ? `<script type="application/ld+json">${JSON.stringify(snap.schemas.length === 1 ? snap.schemas[0] : snap.schemas)}</script>`
    : '';

  return `
    <title>${escapeHtml(snap.title)}</title>
    <meta name="description" content="${escapeHtml(snap.description)}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="alternate" href="${canonical}" hreflang="fr-TN" />
    <link rel="alternate" href="${canonical}" hreflang="x-default" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="MotoScoot.tn" />
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
function renderHomeShell(): string {
  return `
    <div data-home-shell aria-hidden="true" style="position:relative;background:#E25C00">
      <div style="position:absolute;top:0;left:0;right:0;z-index:2;height:64px;display:flex;align-items:center;padding:0 16px">
        <img src="https://www.moto-scoot.tn/site-logo/logo-white.svg" alt="" width="120" height="28" style="height:28px;width:auto" onerror="this.style.display='none'" />
      </div>
      <picture>
        <source media="(min-width: 768px)" srcset="https://www.moto-scoot.tn/hero-assets/-hero-background.webp" />
        <img src="/images/hero-mobile-828.webp" alt="" fetchpriority="high" decoding="async" style="display:block;width:100%;height:min(88vh,720px);object-fit:cover" />
      </picture>
    </div>`;
}

function renderFallback(snap: SeoSnapshot): string {
  // SSR fallback content visible to non-JS crawlers / LLM training bots.
  // React hydration replaces this on mount, so end users never see it.
  return `${snap.path === '/' ? renderHomeShell() : ''}
    <noscript>
      <style>.__seo_fallback{font-family:Inter,system-ui,sans-serif;max-width:780px;margin:48px auto;padding:0 24px;line-height:1.6;color:#111}</style>
    </noscript>
    <div class="__seo_fallback" data-seo-fallback>
      <h1>${escapeHtml(snap.h1)}</h1>
      <p>${escapeHtml(snap.intro)}</p>
      <p><a href="/">Retour à l'accueil MotoScoot.tn</a></p>
    </div>
  `;
}

function injectIntoIndex(indexHtml: string, snap: SeoSnapshot): string {
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

  // Inject our route-specific head right before </head>.
  html = html.replace('</head>', `${renderHead(snap)}\n  </head>`);

  // Inject SSR fallback content inside the empty #root so crawlers see real
  // text. React.createRoot will replace it on hydration. We only do this for
  // the noscript fallback; the original <noscript> in index.html is left
  // alone (it's already inside #root and we just enrich it).
  html = html.replace(
    /<div id="root">[\s\S]*?<\/div>/,
    `<div id="root">${renderFallback(snap)}</div>`,
  );

  return html;
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
      const shell = baseHtml
        .replace(/\sdata-pre-hydrate/g, '')
        .replace(/<link[^>]+rel="preload"[^>]+as="image"[^>]*>/gi, '')
        .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
        .replace(/<link\s+rel="alternate"[^>]*hreflang="[^"]*"[^>]*>/gi, '')
        .replace(/<meta\s+property="og:url"[^>]*>/gi, '');
      await fs.writeFile(SPA_SHELL, shell, 'utf-8');

      let written = 0;
      for (const snap of SEO_SNAPSHOTS) {
        // Root snapshot REPLACES dist/index.html so the homepage gets the full
        // home metadata. Every other route writes to <outDir>/<path>/index.html
        // so SPA hosts (Vercel, Netlify, Cloudflare Pages) serve the
        // pre-stamped HTML when a deep URL is requested directly.
        const html = injectIntoIndex(baseHtml, snap);
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
