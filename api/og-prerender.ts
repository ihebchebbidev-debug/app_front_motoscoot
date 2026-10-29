/**
 * Universal prerender for dynamic detail pages (articles, tips, garages,
 * tech-specs). Vercel rewrites crawler requests for these URLs to this
 * function so search engines and LLM bots receive a fully-stamped HTML
 * document — not the empty SPA shell.
 *
 * Real users never hit this endpoint: the rewrite only matches when the
 * request UA looks like a crawler. Humans go straight to /index.html and
 * hydrate the React app normally.
 *
 * Path shape we expect:  /<kind>/<slug>-<id>
 *   kind ∈ article | guide | garage | fiche-technique
 *
 * Source of truth for each kind:
 *   article  → /api/articles/:idOrSlug
 *   guide    → /api/tips/:idOrSlug
 *   garage   → /api/garages/:id
 *   fiche-technique → /api/tech-specs/:id
 */

import { renderWithApp, scriptSafeJson, detailIdentifier } from '../utils/detailHtml.js';
import { verifiedReviewMarkup } from '../utils/reviewUtils.js';
const API_BASE = 'https://motoscoot.ihebchebbi.pro/api';
const SITE = 'https://www.moto-scoot.tn';
const DEFAULT_OG = `${SITE}/og-banner.webp`;

const UUID_TAIL_RE = /-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const ID_RE = /-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;

const escapeHtml = (s: string) =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toHttps = (url: string) => (url ? url.replace(/^http:\/\//i, 'https://') : url);

const slugify = (s: string): string =>
  (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '');

// Rewrite backend storage hostnames to the public www.moto-scoot.tn domain AND
// inject the listing / post slug into the path so every image URL exposed to
// Google looks like  https://www.moto-scoot.tn/m/<slug>/<file>.webp  instead
// of a meaningless UUID. The /m/<slug>/<file> path is proxied by vercel.json
// straight back to the real upload, so bytes are unchanged — only the URL is
// SEO-friendly. Falls back to the host-only rewrite when no slug is provided.
const rewriteImageHost = (url: string, slug?: string | null): string => {
  if (!url) return url;
  let out = toHttps(url);
  out = out.replace(/^https:\/\/(www\.)?motoscoot\.ihebchebbi\.pro\//i, `${SITE}/`);
  const cleanSlug = slug ? slugify(slug) : '';
  if (!cleanSlug) return out;
  const m = out.match(/\/uploads\/([^?#]+)/i);
  if (!m) return out;
  const rest = m[1];
  if (rest.startsWith('thumbnails/')) {
    return `${SITE}/m/${cleanSlug}/t/${rest.slice('thumbnails/'.length)}`;
  }
  return `${SITE}/m/${cleanSlug}/${rest}`;
};
const stripHtml = (s: string) => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

type Kind = 'article' | 'guide' | 'garage' | 'fiche-technique';

const KIND_CONFIG: Record<Kind, { api: (id: string) => string; ogType: string; label: string }> = {
  article:           { api: (id) => `${API_BASE}/articles/${encodeURIComponent(id)}`,    ogType: 'article', label: 'Actualité' },
  guide:             { api: (id) => `${API_BASE}/tips/${encodeURIComponent(id)}`,        ogType: 'article', label: 'Conseil' },
  garage:            { api: (id) => `${API_BASE}/garages/${encodeURIComponent(id)}`,     ogType: 'website', label: 'Garage' },
  'fiche-technique': { api: (id) => `${API_BASE}/tech-specs/${encodeURIComponent(id)}`,  ogType: 'product', label: 'Fiche technique' },
};

interface Doc {
  id?: string;
  title?: string;
  name?: string;
  brand?: string;
  model?: string;
  year?: number;
  category?: string;
  excerpt?: string;
  description?: string;
  content?: string;
  body?: string;
  summary?: string;
  image?: string;
  cover?: string;
  cover_image?: string;
  thumbnail?: string;
  images?: string[];
  gallery?: string[];
  brand_logo?: string;
  logo?: string;
  logo_url?: string;
  city?: string;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  price_new?: number | string;
  engine?: any;
  dimensions?: any;
  consumption?: string;
  top_speed?: string;
  available_in_tunisia?: boolean;
  rating?: number | string;
  reviews_count?: number;
  reviews?: Array<{ rating?: unknown; is_verified?: boolean; author_name?: string; content?: string; created_at?: string }>;
}

function pickSlug(kind: Kind, d: Doc | null): string {
  if (!d) return '';
  if (kind === 'fiche-technique') {
    return [d.brand, d.model, d.year].filter(Boolean).join('-');
  }
  if (kind === 'garage') {
    return [d.name || d.title, d.city].filter(Boolean).join('-');
  }
  return d.title || d.name || '';
}

function pickImage(d: Doc | null, slug?: string | null): string {
  if (!d) return DEFAULT_OG;
  const cand = d.image || d.cover_image || d.cover || d.thumbnail
    || (Array.isArray(d.gallery) ? d.gallery[0] : undefined)
    || (Array.isArray(d.images) ? d.images[0] : undefined);
  return rewriteImageHost(cand || DEFAULT_OG, slug);
}

function pickGallery(d: Doc | null, slug?: string | null): string[] {
  if (!d) return [];
  const arr: string[] = [];
  if (d.image) arr.push(d.image);
  if (Array.isArray(d.gallery)) arr.push(...d.gallery);
  if (Array.isArray(d.images)) arr.push(...d.images);
  return Array.from(new Set(arr.map(u => rewriteImageHost(u, slug)).filter(Boolean))).slice(0, 6);
}

function parsePrice(v: any): number | null {
  if (v == null) return null;
  const digits = String(v).replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pickTitle(kind: Kind, d: Doc | null): string {
  if (!d) return `${KIND_CONFIG[kind].label} | MotoScoot`;
  if (kind === 'fiche-technique') {
    const t = [d.brand, d.model, d.year].filter(Boolean).join(' ').trim();
    // Match competitor SERP pattern: "<Brand> <Model> Prix en Tunisie"
    return `${t || 'Fiche technique'} Prix en Tunisie | MotoScoot.tn`;
  }
  if (kind === 'garage') {
    return `${d.name || d.title || 'Garage'} — Garage Moto${d.city ? ` à ${d.city}` : ''} | MotoScoot`;
  }
  return `${d.title || d.name || KIND_CONFIG[kind].label} | MotoScoot`;
}

function buildSpecSnippet(d: Doc): string {
  // "·"-separated spec line so Google can lift it as the SERP snippet,
  // mirroring the competitor's rich result format.
  const parts: string[] = [];
  const head = [d.brand, d.model].filter(Boolean).join(' ').trim();
  if (head) parts.push(head);
  if (d.year) parts.push(`Année ${d.year}`);
  parts.push('Énergie Essence');
  const cc = d.engine?.cc ? String(d.engine.cc).replace(/[^\d]/g, '') : '';
  if (cc) parts.push(`Moteur ${cc} cc${d.engine?.fuel_system ? `, ${d.engine.fuel_system}` : ''}`);
  if (d.engine?.power) parts.push(`Puissance ${d.engine.power}`);
  if (d.top_speed) parts.push(`Vitesse maximale ${d.top_speed}`);
  if (d.engine?.acceleration) parts.push(`0-100 km/h ${d.engine.acceleration}`);
  if (d.engine?.torque) parts.push(`Couple maxi ${d.engine.torque}`);
  if (d.consumption) parts.push(`Conso ${d.consumption}`);
  return parts.filter(Boolean).join(' · ');
}

function pickDescription(kind: Kind, d: Doc | null): string {
  if (!d) {
    return "Découvrez nos motos, scooters, garages et conseils en Tunisie sur MotoScoot.tn.";
  }
  if (kind === 'fiche-technique') {
    const spec = buildSpecSnippet(d);
    if (spec) return clip(spec, 300);
  }
  const raw = d.excerpt || d.summary || d.description || d.content || d.body || '';
  const text = stripHtml(String(raw));
  if (text) return clip(text, 160);
  if (kind === 'fiche-technique') {
    return clip(`Caractéristiques techniques ${[d.brand, d.model, d.year].filter(Boolean).join(' ')} : performance, équipements, prix en Tunisie sur MotoScoot.`, 160);
  }
  if (kind === 'garage') {
    return clip(`Découvrez le garage moto ${d.name || ''}${d.city ? ` à ${d.city}` : ''} sur MotoScoot.tn : services, avis et contact.`, 160);
  }
  return clip(`${d.title || ''} — à lire sur MotoScoot.tn, la première plateforme moto et scooter en Tunisie.`, 160);
}

async function fetchDoc(kind: Kind, id: string): Promise<Doc | null> {
    const r = await fetch(KIND_CONFIG[kind].api(id), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (r.status === 404 && (kind === 'guide' || kind === 'article')) {
      const endpoint = kind === 'guide' ? 'tips' : 'articles';
      for (let page = 1; page <= 100; page++) {
        const response = await fetch(`${API_BASE}/${endpoint}?page=${page}&limit=100`, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error('Content service unavailable');
        const list = await response.json();
        const rows = Array.isArray(list) ? list : list[endpoint] || [];
        const hit = rows.find((row: any) => String(row.id) === id || row.slug === id);
        if (hit?.slug) {
          const retry = await fetch(KIND_CONFIG[kind].api(hit.slug), { signal: AbortSignal.timeout(5000) });
          if (retry.status === 404) return null;
          if (!retry.ok) throw new Error('Content service unavailable');
          return await retry.json();
        }
        if (rows.length < 100 || (list.pagination?.totalPages && page >= list.pagination.totalPages)) return null;
      }
      throw new Error('Content pagination incomplete');
    }
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('Content service unavailable');
    const data = await r.json();
    // Unwrap common envelope shapes.
    return (data?.article || data?.tip || data?.garage || data?.spec || data?.techSpec || data?.data || data) as Doc;
}

function buildJsonLd(kind: Kind, d: Doc | null, canonical: string, image: string, title: string, description: string) {
  if (!d) return null;
  if (kind === 'article' || kind === 'guide') {
    return {
      '@context': 'https://schema.org',
      '@type': kind === 'guide' ? 'HowTo' : 'Article',
      headline: title,
      description,
      image: [image],
      url: canonical,
      datePublished: d.published_at || d.created_at,
      dateModified: d.updated_at || d.created_at,
      mainEntityOfPage: canonical,
      publisher: {
        '@type': 'Organization',
        name: 'MotoScoot.tn',
        logo: { '@type': 'ImageObject', url: `${SITE}/og-image.jpg` },
      },
    };
  }
  if (kind === 'fiche-technique') {
    const price = parsePrice(d.price_new);
    const name = [d.brand, d.model, d.year].filter(Boolean).join(' ') || title;
    const gallery = pickGallery(d, pickSlug(kind, d));
    const brandSlug = d.brand ? slugify(d.brand) : '';
    const brandLogoRaw = d.brand_logo || d.logo || d.logo_url || '';
    const brandLogo = brandLogoRaw ? rewriteImageHost(brandLogoRaw, brandSlug ? `${brandSlug}-logo` : '') : '';
    const brandNode = d.brand
      ? { '@type': 'Brand', name: d.brand, ...(brandLogo ? { logo: brandLogo } : {}) }
      : undefined;
    const engineCC = d.engine?.cc ? String(d.engine.cc).replace(/[^\d]/g, '') : '';
    const engineDisplacement = engineCC ? parseInt(engineCC, 10) : null;
    const validUntil = new Date(Date.now() + 180 * 86400_000).toISOString().slice(0, 10);

    // Google requires Product to expose offers/review/aggregateRating.
    // When we know the price we emit a valid Offer; otherwise we fall back
    // to a Vehicle entity (no such requirement) to avoid validator errors.
    if (price) {
      return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name,
        description,
        image: gallery.length ? gallery : [image],
        sku: d.id ? `MS-${d.id}` : undefined,
        mpn: d.model || undefined,
        category: d.category || 'Motorcycle',
        brand: brandNode,
        url: canonical,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'TND',
          price,
          availability: d.available_in_tunisia === false
            ? 'https://schema.org/OutOfStock'
            : 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
          url: canonical,
          priceValidUntil: validUntil,
          seller: { '@type': 'Organization', name: 'MotoScoot.tn', url: SITE },
        },
        ...(engineDisplacement ? {
          additionalProperty: [
            { '@type': 'PropertyValue', name: 'Cylindrée', value: `${engineDisplacement} cc` },
            ...(d.engine?.power ? [{ '@type': 'PropertyValue', name: 'Puissance', value: String(d.engine.power) }] : []),
            ...(d.top_speed ? [{ '@type': 'PropertyValue', name: 'Vitesse max', value: String(d.top_speed) }] : []),
            ...(d.consumption ? [{ '@type': 'PropertyValue', name: 'Consommation', value: String(d.consumption) }] : []),
          ],
        } : {}),
      };
    }
    return {
      '@context': 'https://schema.org',
      '@type': 'Vehicle',
      name,
      description,
      image: gallery.length ? gallery : [image],
      url: canonical,
      brand: brandNode,
      manufacturer: d.brand ? { '@type': 'Organization', name: d.brand } : undefined,
      model: d.model || undefined,
      vehicleModelDate: d.year || undefined,
      bodyType: d.category || 'Motorcycle',
      fuelType: 'Petrol',
      ...(engineDisplacement ? {
        vehicleEngine: {
          '@type': 'EngineSpecification',
          engineDisplacement: { '@type': 'QuantitativeValue', value: engineDisplacement, unitCode: 'CMQ' },
        },
      } : {}),
    };
  }
  if (kind === 'garage') {
    return {
      '@context': 'https://schema.org',
      '@type': 'AutoRepair',
      name: d.name || title,
      description,
      image: [image],
      url: canonical,
      address: d.city ? { '@type': 'PostalAddress', addressLocality: d.city, addressCountry: 'TN' } : undefined,
      ...verifiedReviewMarkup(d.reviews || []),
    };
  }
  return null;
}

export default async function handler(req: any, res: any) {
  try {
    const kind = String(req.query?.kind || '').toLowerCase() as Kind;
    const slugid = String(req.query?.slugid || '');
    if (!KIND_CONFIG[kind] || !slugid) {
      res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8').send('<!doctype html><title>Not found</title>');
      return;
    }

    // Technical sheets: /fiche-technique/<slug> (short) or legacy <slug>-<uuid>.
    // Other kinds: <slug>-<uuid|number>.
    const cleanSlugid = slugid.replace(/\/$/, '');
    const id = detailIdentifier(kind, cleanSlugid);

    const doc = await fetchDoc(kind, id);
    if (!doc || (!doc.id && !doc.title && !doc.name && !doc.model)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Robots-Tag', 'noindex');
      res.status(404).send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8" /><title>Page introuvable | MotoScoot</title><meta name="robots" content="noindex" /></head><body><h1>Page introuvable</h1><p><a href="${SITE}/">Retour à l'accueil</a></p></body></html>`);
      return;
    }
    if (kind === 'garage') {
      const response = await fetch(`${API_BASE}/garages/${encodeURIComponent(String(doc.id))}/reviews`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('Reviews unavailable');
      const data = await response.json();
      doc.reviews = Array.isArray(data) ? data : data.reviews || [];
    }
    // Short slug URL is canonical for technical sheets; legacy URLs 301 to it.
    if (kind === 'fiche-technique' && (doc as any).slug && cleanSlugid !== (doc as any).slug) {
      res.setHeader('Location', `${SITE}/fiche-technique/${(doc as any).slug}`);
      res.status(301).end();
      return;
    }
    const normalizedTail = kind === 'fiche-technique' ? (doc as any).slug || cleanSlugid
      : `${slugify(kind === 'garage' ? [doc.name, doc.city].filter(Boolean).join(' ') : doc.title || '')}-${doc.id}`;
    if (cleanSlugid !== normalizedTail) {
      res.setHeader('Location', `${SITE}/${kind}/${normalizedTail}`);
      res.status(301).end();
      return;
    }
    const canonical = `${SITE}/${kind}/${normalizedTail}`;
    const slug = pickSlug(kind, doc);
    const title = pickTitle(kind, doc);
    const description = pickDescription(kind, doc);
    const image = pickImage(doc, slug);
    const ogType = KIND_CONFIG[kind].ogType;
    const ld = buildJsonLd(kind, doc, canonical, image, title, description);

    // BreadcrumbList — emitted on every prerender so Google can build the
    // breadcrumb display in SERPs.
    const breadcrumbs: any[] = [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE}/` },
    ];
    if (kind === 'fiche-technique') {
      breadcrumbs.push({ '@type': 'ListItem', position: 2, name: 'Fiches techniques', item: `${SITE}/fiches-techniques` });
      if (doc?.brand) breadcrumbs.push({ '@type': 'ListItem', position: 3, name: doc.brand, item: `${SITE}/fiches-techniques/${encodeURIComponent(String(doc.brand).toLowerCase())}` });
    } else if (kind === 'article') {
      breadcrumbs.push({ '@type': 'ListItem', position: 2, name: 'Actualités', item: `${SITE}/actualites` });
    } else if (kind === 'guide') {
      breadcrumbs.push({ '@type': 'ListItem', position: 2, name: 'Conseils', item: `${SITE}/conseils` });
    } else if (kind === 'garage') {
      breadcrumbs.push({ '@type': 'ListItem', position: 2, name: 'Garages', item: `${SITE}/garages` });
    }
    breadcrumbs.push({ '@type': 'ListItem', position: breadcrumbs.length + 1, name: title, item: canonical });
    const breadcrumbLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs,
    };

    const price = kind === 'fiche-technique' ? parsePrice(doc?.price_new) : null;


    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
<link rel="canonical" href="${canonical}" />
<link rel="alternate" href="${canonical}" hreflang="fr-TN" />
<link rel="alternate" href="${canonical}" hreflang="x-default" />

<meta property="og:type" content="${ogType}" />
<meta property="og:site_name" content="MotoScoot.tn" />
<meta property="og:locale" content="fr_TN" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:secure_url" content="${image}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${escapeHtml(title)}" />
${price ? `<meta property="product:price:amount" content="${price}" />\n<meta property="product:price:currency" content="TND" />` : ''}

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@motoscoot_tn" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${image}" />

${ld ? `<script type="application/ld+json">${scriptSafeJson(ld)}</script>` : ''}
<script type="application/ld+json">${scriptSafeJson(breadcrumbLd)}</script>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
${kind === 'fiche-technique' && price ? `<p><strong>${price.toLocaleString('fr-FR')} DT</strong></p>` : ''}
${doc ? (() => {
  const fullBody = stripHtml(String(doc.content || doc.body || doc.description || ''));
  return fullBody ? `<article>${escapeHtml(fullBody).slice(0, 4000)}</article>` : '';
})() : ''}
${kind === 'garage' ? (doc.reviews || []).map(review => `<section><h2>${escapeHtml(review.author_name || 'Utilisateur')}</h2><p>${escapeHtml(String(review.rating || ''))} / 5</p><p>${escapeHtml(review.content || '')}</p></section>`).join('') : ''}
${image && image !== DEFAULT_OG ? `<img src="${image}" alt="${escapeHtml(title)}" loading="lazy" />` : ''}
<p><a href="${canonical}">Voir sur MotoScoot.tn</a></p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    res.status(200).send(await renderWithApp(req, html));
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Retry-After', '60');
    res.status(503).setHeader('Content-Type', 'text/html; charset=utf-8').send('<!doctype html><html lang="fr"><head><title>Page temporairement indisponible | MotoScoot</title><meta name="robots" content="noindex"></head><body><h1>Page temporairement indisponible</h1><p>Veuillez réessayer dans quelques instants.</p></body></html>');
  }
}
