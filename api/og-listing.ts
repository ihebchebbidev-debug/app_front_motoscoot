/**
 * Vercel serverless function — renders SEO-grade HTML for listing pages
 * when a crawler (Googlebot, Bingbot, FB, X, WhatsApp, LinkedIn, GPTBot,
 * ClaudeBot, PerplexityBot, …) requests `/annonce/<slug>-<id>`.
 *
 * Real users never hit this endpoint: vercel.json only rewrites to it when
 * the request UA matches a known crawler. Humans get the SPA shell.
 *
 * What we emit:
 *  - Full title / description / canonical / hreflang.
 *  - Open Graph (product) + Twitter card with real listing image.
 *  - JSON-LD: Product + Vehicle + BreadcrumbList so Google can build
 *    rich result cards and Knowledge Graph entries.
 *  - A keyword-rich, semantic <body> (h1, dl of specs, description) so
 *    JS-less crawlers and LLM indexers see real, indexable content.
 *
 * IMPORTANT: NO `<meta http-equiv="refresh">` here. Googlebot would treat
 * it as a soft redirect to the same URL (which rewrites back to us), and
 * either get a redirect loop or refuse to index the canonical page.
 */

import { renderWithApp, scriptSafeJson } from '../utils/detailHtml.js';
const API_BASE = 'https://motoscoot.ihebchebbi.pro/api';
const SITE = 'https://www.moto-scoot.tn';
const DEFAULT_OG = `${SITE}/og-banner.webp`;

// Match a UUID OR a numeric id at the end of the slug.
const ID_RE = /-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;

const escapeHtml = (s: string) =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toHttps = (url: string) => (url ? url.replace(/^http:\/\//i, 'https://') : url);

/** Mirror of utils/urlUtils.ts slugify so canonical URLs match the app. */
const frontSlugify = (text: string): string => {
  if (!text) return 'details';
  return text.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');
};

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
    .replace(/^-|-$/g, '')
    .slice(0, 60);

// Rewrite backend storage hostnames to www.moto-scoot.tn AND inject the
// listing slug so the image URL exposed to Google is
//   https://www.moto-scoot.tn/m/<slug>/<file>.webp
// (vercel.json proxies /m/<slug>/<file> back to the real upload).
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

const formatPrice = (n: number | null | undefined) =>
  typeof n === 'number' ? `${n.toLocaleString('fr-FR')} DT` : '';

interface Listing {
  id: string;
  title: string;
  description?: string;
  brand?: string;
  model?: string;
  price?: number;
  year?: number;
  mileage?: number;
  cc?: number;
  city?: string;
  fuel?: string;
  transmission?: string;
  color?: string;
  condition?: string;
  images?: string[];
  brand_logo?: string;
  created_at?: string;
  updated_at?: string;
}

export default async function handler(req: any, res: any) {
  try {
    const slugid =
      (req.query?.slugid as string) ||
      (req.url || '').replace(/^\/+/, '').split('?')[0];

    const m = slugid.match(ID_RE);
    const id = m?.[1];

    const canonical = `${SITE}/annonce/${slugid.replace(/^annonce\//, '')}`;

    let listing: Listing | null = null;
    let notFound = false;
    if (id) {
      try {
        const r = await fetch(`${API_BASE}/listings/${id}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(5000),
        });
        if (r.ok) {
          const data = await r.json();
          listing = (data?.listing || data) as Listing;
          if (!listing?.id) throw new Error('Invalid listing');
        } else if (r.status === 404) {
          notFound = true;
        } else { throw new Error('Listing service unavailable'); }
      } catch {
        throw new Error('Listing service unavailable');
      }
    }

    if (!id || notFound) {
      // Unknown listing: real 404, noindex, no canonical (soft-404 fix).
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Robots-Tag', 'noindex');
      res.status(404).send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8" /><title>Annonce introuvable | MotoScoot</title><meta name="robots" content="noindex" /></head><body><h1>Annonce introuvable</h1><p><a href="${SITE}/annonces">Voir les annonces</a></p></body></html>`);
      return;
    }

    // One URL per listing: /annonce/<slug>-<number>. Other variants 301 here.
    if (listing) {
      const publicId = (listing as any).listing_number ?? listing.id;
      const canonicalPath = `/annonce/${frontSlugify(listing.title || '')}-${publicId}`;
      if (`/annonce/${slugid.replace(/^annonce\//, '')}`.replace(/\/$/, '') !== canonicalPath) {
        res.setHeader('Location', `${SITE}${canonicalPath}`);
        res.status(301).end();
        return;
      }
    }

    const title = listing
      ? `${String(listing.title).replace(/\s+/g, " ").trim()}${listing.price ? ` — ${formatPrice(listing.price)}` : ''} | MotoScoot`
      : "Annonce Moto & Scooter d'Occasion | MotoScoot";

    const descBits: string[] = [];
    if (listing) {
      if (listing.year) descBits.push(`${listing.year}`);
      if (listing.mileage != null) descBits.push(`${listing.mileage.toLocaleString('fr-FR')} km`);
      if (listing.cc) descBits.push(`${listing.cc} cc`);
      if (listing.city) descBits.push(listing.city);
    }
    const description = listing
      ? `${listing.brand || ''} ${listing.model || ''} — ${descBits.join(' · ')}. ${
          (listing.description || '').slice(0, 140).replace(/\s+/g, ' ').trim()
        }`.trim().slice(0, 300)
      : "Découvrez les annonces de motos et scooters d'occasion sur MotoScoot.tn.";

    const imgSlug = listing ? [listing.brand, listing.model, listing.year].filter(Boolean).join('-') || listing.title : '';
    const image = rewriteImageHost(listing?.images?.[0] || DEFAULT_OG, imgSlug);
    const allImages = (listing?.images || []).map(u => rewriteImageHost(u, imgSlug)).slice(0, 6);
    const brandLogo = listing?.brand_logo ? rewriteImageHost(listing.brand_logo, listing.brand ? `${slugify(listing.brand)}-logo` : '') : '';
    const brandNode = listing?.brand ? { '@type': 'Brand', name: listing.brand, ...(brandLogo ? { logo: brandLogo } : {}) } : undefined;

    // ---- JSON-LD: Product + Vehicle + Breadcrumbs ----
    const productLd = listing ? {
      '@context': 'https://schema.org',
      // Product requires offers/review/aggregateRating. Without a price we
      // emit a Vehicle (no such requirement) instead of an invalid Product.
      '@type': listing.price ? 'Product' : 'Vehicle',
      name: listing.title,
      description: description,
      image: allImages.length ? allImages : [image],
      brand: brandNode,
      model: listing.model || undefined,
      url: canonical,
      sku: listing.id,
      offers: listing.price ? {
        '@type': 'Offer',
        priceCurrency: 'TND',
        price: listing.price,
        availability: 'https://schema.org/InStock',
        url: canonical,
        priceValidUntil: new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10),
        itemCondition: listing.condition === 'new'
          ? 'https://schema.org/NewCondition'
          : 'https://schema.org/UsedCondition',
      } : undefined,
    } : null;

    const vehicleLd = listing ? {
      '@context': 'https://schema.org',
      '@type': 'Vehicle',
      name: listing.title,
      brand: listing.brand,
      model: listing.model,
      vehicleModelDate: listing.year,
      mileageFromOdometer: listing.mileage != null
        ? { '@type': 'QuantitativeValue', value: listing.mileage, unitCode: 'KMT' }
        : undefined,
      vehicleEngine: listing.cc
        ? { '@type': 'EngineSpecification', engineDisplacement: { '@type': 'QuantitativeValue', value: listing.cc, unitCode: 'CMQ' } }
        : undefined,
      fuelType: listing.fuel || 'Petrol',
      vehicleTransmission: listing.transmission || undefined,
      color: listing.color || undefined,
      image: allImages.length ? allImages : [image],
      url: canonical,
    } : null;

    const breadcrumbLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Annonces', item: `${SITE}/annonces` },
        listing?.brand
          ? { '@type': 'ListItem', position: 3, name: listing.brand, item: `${SITE}/annonces` }
          : null,
        { '@type': 'ListItem', position: listing?.brand ? 4 : 3, name: listing?.title || 'Annonce', item: canonical },
      ].filter(Boolean),
    };

    const allLd = [productLd, vehicleLd, breadcrumbLd].filter(Boolean);

    // ---- Body content (visible to non-JS crawlers + LLMs) ----
    const specRow = (label: string, value?: string | number | null) =>
      value != null && value !== '' ? `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd>` : '';

    const bodyHtml = listing ? `
<h1>${escapeHtml(listing.title)}</h1>
${listing.price ? `<p><strong>Prix :</strong> ${escapeHtml(formatPrice(listing.price))}</p>` : ''}
<dl>
  ${specRow('Marque', listing.brand)}
  ${specRow('Modèle', listing.model)}
  ${specRow('Année', listing.year)}
  ${specRow('Kilométrage', listing.mileage != null ? `${listing.mileage.toLocaleString('fr-FR')} km` : '')}
  ${specRow('Cylindrée', listing.cc ? `${listing.cc} cc` : '')}
  ${specRow('Carburant', listing.fuel)}
  ${specRow('Transmission', listing.transmission)}
  ${specRow('Couleur', listing.color)}
  ${specRow('Ville', listing.city)}
</dl>
${listing.description ? `<h2>Description</h2><p>${escapeHtml(listing.description.slice(0, 1500))}</p>` : ''}
${allImages.length ? `<h2>Photos</h2>${allImages.map(src => `<img src="${src}" alt="${escapeHtml(listing.title)}" loading="lazy" />`).join('')}` : ''}
<p><a href="${canonical}">Voir l'annonce complète sur MotoScoot.tn</a></p>
` : `
<h1>Annonce non disponible</h1>
<p>Cette annonce n'est plus disponible. <a href="${SITE}/annonces">Voir toutes les annonces moto & scooter en Tunisie</a>.</p>
`;

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

<meta property="og:type" content="product" />
<meta property="og:site_name" content="MotoScoot.tn" />
<meta property="og:locale" content="fr_TN" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:secure_url" content="${image}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${escapeHtml(listing?.title || 'MotoScoot')}" />
${listing?.price ? `<meta property="product:price:amount" content="${listing.price}" />` : ''}
${listing?.price ? `<meta property="product:price:currency" content="TND" />` : ''}
${listing?.condition ? `<meta property="product:condition" content="${listing.condition === 'new' ? 'new' : 'used'}" />` : ''}

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@motoscoot_tn" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${image}" />

${allLd.map(ld => `<script type="application/ld+json">${scriptSafeJson(ld)}</script>`).join('\n')}
</head>
<body>
${bodyHtml}
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    res.status(200).send(await renderWithApp(req, html));
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Retry-After', '60');
    res.status(503).setHeader('Content-Type', 'text/html; charset=utf-8').send('<!doctype html><html lang="fr"><head><title>Annonce temporairement indisponible | MotoScoot</title><meta name="robots" content="noindex"></head><body><h1>Annonce temporairement indisponible</h1><p>Veuillez réessayer dans quelques instants.</p></body></html>');
  }
}
