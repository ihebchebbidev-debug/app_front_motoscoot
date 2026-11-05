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
import { GARAGES_PUBLIC, GARAGES_ROBOTS } from '../config/features.js';
import { techSpecTitle, techSpecDescription, techSpecSummary, techSpecPriceBlock, TECH_SPEC_PRICE_LABEL, similarTechSpecs, SIMILAR_MODELS_HEADING, type SimilarModel } from '../utils/techSpecSeo.js';
import { isThinContent, THIN_CONTENT_ROBOTS, crawlerBodyHtml, realAuthorName, ORGANIZATION_NODE, editorialTitle } from '../utils/editorial.js';
import {
  SCOOTER_125_BREADCRUMB, SCOOTER_125_PATH, Scooter125Row, fmtCh, fmtDt, fmtKg, scooter125Advice, scooter125Bands,
  scooter125Description, scooter125Faq, scooter125Heading, scooter125Intro, scooter125Method, scooter125Rows,
  scooter125SourceFromApi, scooter125Title,
} from '../utils/scooter125Guide.js';
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

// "124.7 cc" → 124.7. Keeping only digits turned it into 1247 cc.
export const parseCc = (v: unknown): number | null => {
  const m = String(v ?? '').match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const fmtNum = (n: number) => n.toLocaleString('fr-FR');

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
  slug?: string;
  engine?: any;
  chassis?: any;
  electronics?: any;
  dimensions?: any;
  importer?: { name?: string; city?: string } | null;
  consumption?: string;
  top_speed?: string;
  available_in_tunisia?: boolean;
  rating?: number | string;
  reviews_count?: number;
  author_name?: string;
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
  if (!d) return `${KIND_CONFIG[kind].label} | Moto-Scoot.tn`;
  if (kind === 'fiche-technique') return techSpecTitle(d);
  if (kind === 'garage') {
    return `${d.name || d.title || 'Garage'} — Garage Moto${d.city ? ` à ${d.city}` : ''} | Moto-Scoot.tn`;
  }
  // article / guide
  return editorialTitle(d.title || d.name || KIND_CONFIG[kind].label);
}

function pickDescription(kind: Kind, d: Doc | null): string {
  if (!d) {
    return "Découvrez nos motos, scooters, garages et conseils en Tunisie sur Moto-Scoot.tn.";
  }
  if (kind === 'fiche-technique') {
    return techSpecDescription({ brand: d.brand, model: d.model, category: d.category, price: d.price_new, cc: d.engine?.cc, power: d.engine?.power, weight: d.dimensions?.weight });
  }
  const raw = d.excerpt || d.summary || d.description || d.content || d.body || '';
  const text = stripHtml(String(raw));
  if (text) return clip(text, 160);
  if (kind === 'garage') {
    return clip(`Découvrez le garage moto ${d.name || ''}${d.city ? ` à ${d.city}` : ''} sur Moto-Scoot.tn : services, avis et contact.`, 160);
  }
  return clip(`${d.title || ''}. À lire sur Moto-Scoot.tn, la marketplace tunisienne des motos et scooters.`, 160);
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
      // Guides are articles too: HowTo rich results were removed in 2023 and
      // these pages have no step-by-step markup.
      '@type': 'Article',
      headline: d.title || title,
      description,
      image: [image],
      url: canonical,
      datePublished: d.published_at || d.created_at,
      dateModified: d.updated_at || d.created_at,
      inLanguage: 'fr-TN',
      ...(d.category ? { articleSection: d.category } : {}),
      mainEntityOfPage: canonical,
      // The byline's author; placeholder CMS accounts ("Admin Admin") are
      // credited to the organization instead of a fake person.
      author: realAuthorName(d.author_name)
        ? { '@type': 'Person', name: realAuthorName(d.author_name) }
        : ORGANIZATION_NODE,
      publisher: ORGANIZATION_NODE,
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
    const engineDisplacement = parseCc(d.engine?.cc);

    // Google requires Product to expose offers/review/aggregateRating.
    // When we know the price we emit a valid Offer; otherwise we fall back
    // to a Vehicle entity (no such requirement) to avoid validator errors.
    // The Offer is the catalogue price of the new model: Moto-Scoot.tn does not
    // sell it, so no seller, stock status or invented validity date.
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
          itemCondition: 'https://schema.org/NewCondition',
          url: canonical,
        },
        ...(engineDisplacement ? {
          additionalProperty: [
            { '@type': 'PropertyValue', name: 'Cylindrée', value: engineDisplacement, unitCode: 'CMQ' },
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
    if (!GARAGES_PUBLIC) return null;
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

const SPEC_ROWS: Array<[string, (d: Doc) => unknown]> = [
  ['Cylindrée', (d) => d.engine?.cc],
  ['Moteur', (d) => d.engine?.type],
  ['Puissance', (d) => d.engine?.power],
  ['Couple', (d) => d.engine?.torque],
  ['Refroidissement', (d) => d.engine?.cooling],
  ['Alimentation', (d) => d.engine?.fuelSystem || d.engine?.fuel_system],
  ['Transmission', (d) => d.engine?.transmission],
  ['Vitesse maximale', (d) => d.top_speed],
  ['Consommation', (d) => d.consumption],
  ['Réservoir', (d) => d.dimensions?.tank],
  ['Poids', (d) => d.dimensions?.weight],
  ['Hauteur de selle', (d) => d.dimensions?.seatHeight],
  ['Longueur', (d) => d.dimensions?.length],
  ['Empattement', (d) => d.dimensions?.wheelbase],
  ['Cadre', (d) => d.chassis?.frame],
  ['Frein avant', (d) => d.chassis?.brakesFront],
  ['Frein arrière', (d) => d.chassis?.brakesRear],
  ['Pneu avant', (d) => d.chassis?.tireFront],
  ['Pneu arrière', (d) => d.chassis?.tireRear],
  ['ABS', (d) => d.electronics?.abs],
  ['Antipatinage', (d) => d.electronics?.tcs],
];

// Fiche technique body for crawlers that do not run JavaScript, in the same
// order as the page: the "Prix neuf en Tunisie" rows (dated price,
// availability, dealer), the full spec table, the "Modèles similaires"
// (closest price, same family and displacement), then the summary and the
// 125 scooter prices link (price with the date
// it was checked, importer), then links to the brand, the catalogue and the
// comparator.
export function renderFicheBody(d: Doc, similar: SimilarModel[] = []): string {
  const name = [d.brand, d.model].filter(Boolean).join(' ');
  const block = techSpecPriceBlock({
    brand: d.brand, model: d.model, category: d.category, cc: d.engine?.cc, price: d.price_new, updatedAt: d.updated_at,
    availableInTunisia: d.available_in_tunisia, importerName: d.importer?.name, importerCity: d.importer?.city,
  });
  const priceRows = [
    [block.priceLabel, block.price],
    ['Disponibilité', block.availability],
    ['Concessionnaire', block.dealer],
  ].filter(([, v]) => v).map(([l, v]) => `<tr><th scope="row">${escapeHtml(String(l))}</th><td>${escapeHtml(String(v))}</td></tr>`).join('\n');
  const priceSection = priceRows ? `<section>
<h2>${TECH_SPEC_PRICE_LABEL}</h2>
<table>
${priceRows}
</table>
</section>` : '';
  const summary = techSpecSummary({
    brand: d.brand, model: d.model, year: d.year, categoryLabel: d.category, cc: d.engine?.cc, power: d.engine?.power,
    price: d.price_new, updatedAt: d.updated_at, importerName: d.importer?.name, importerCity: d.importer?.city,
  });
  const rows = SPEC_ROWS
    .map(([label, get]) => [label, String(get(d) ?? '').trim()] as const)
    .filter(([, value]) => value)
    .map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join('\n');
  const brandSlug = d.brand ? slugify(d.brand) : '';
  return `<nav aria-label="Fil d'Ariane"><a href="${SITE}/">Accueil</a> › <a href="${SITE}/fiches-techniques">Fiches techniques</a>${brandSlug ? ` › <a href="${SITE}/fiches-techniques/${brandSlug}">${escapeHtml(String(d.brand))}</a>` : ''} › ${escapeHtml(name)}</nav>
<h1>${escapeHtml(name)}</h1>
${priceSection}
${rows ? `<h2>Caractéristiques</h2>\n<table>\n<caption>Fiche technique ${escapeHtml(name)}</caption>\n${rows}\n</table>` : ''}
${similar.length ? `<section>\n<h2>${SIMILAR_MODELS_HEADING}</h2>\n<table>\n${similar.map((m) => `<tr><th scope="row"><a href="${SITE}${m.href}">${escapeHtml(m.name)}</a></th><td>${escapeHtml(m.price)}</td></tr>`).join('\n')}\n</table>\n</section>` : ''}
<p>${escapeHtml(summary)}</p>
${block.pricesLink ? `<p><a href="${SITE}${block.pricesLink.href}">${escapeHtml(block.pricesLink.label)}</a></p>` : ''}
<ul>
${brandSlug ? `<li><a href="${SITE}/fiches-techniques/${brandSlug}">Tous les modèles ${escapeHtml(String(d.brand))}</a></li>` : ''}
<li><a href="${SITE}/comparateur">Comparer avec un autre modèle</a></li>
<li><a href="${SITE}/annonces">Motos et scooters d'occasion en Tunisie</a></li>
</ul>`;
}

// Brand pages (/fiches-techniques/<marque>): title, factual intro and the
// brand's models as plain links, for crawlers that do not run JavaScript.
async function renderBrand(req: any, res: any, brandSlug: string) {
  const brandsRes = await fetch(`${API_BASE}/tech-specs/brands`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
  if (!brandsRes.ok) throw new Error('Content service unavailable');
  const brandsData = await brandsRes.json();
  const brands: any[] = Array.isArray(brandsData) ? brandsData : brandsData.brands || [];
  const brand = brands.map((b) => String(b.brand || b.name || '')).find((name) => name && slugify(name) === brandSlug);
  if (!brand) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.status(404).send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8" /><title>Page introuvable | Moto-Scoot.tn</title><meta name="robots" content="noindex" /></head><body><h1>Page introuvable</h1><p><a href="${SITE}/fiches-techniques">Voir toutes les fiches techniques</a></p></body></html>`);
    return;
  }

  const modelsRes = await fetch(`${API_BASE}/tech-specs/brands/${encodeURIComponent(brand)}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
  if (!modelsRes.ok) throw new Error('Content service unavailable');
  const modelsData = await modelsRes.json();
  const models: Doc[] = Array.isArray(modelsData) ? modelsData : modelsData.models || [];

  const canonical = `${SITE}/fiches-techniques/${brandSlug}`;
  const pageTitle = `${brand} : fiches techniques et prix en Tunisie`;
  const title = `${pageTitle} | Moto-Scoot.tn`;
  const description = `Fiches techniques des modèles ${brand} vendus en Tunisie : prix du neuf en DT, cylindrée, puissance, couple, poids et consommation.`;
  const modelUrl = (m: Doc) => `${SITE}/fiche-technique/${(m as any).slug || `${slugify([m.brand, m.model, m.year].filter(Boolean).join(' '))}-${m.id}`}`;
  const modelName = (m: Doc) => [brand, m.model].filter(Boolean).join(' ');
  const firstImage = models.find((m) => m.image)?.image;
  const image = firstImage ? rewriteImageHost(firstImage, brand) : DEFAULT_OG;

  // Factual intro built from the data (counts and ranges only, no claims).
  const ccs = models.map((m) => Math.round(parseCc(m.engine?.cc) || 0)).filter((n) => n > 0);
  const prices = models.map((m) => parsePrice(m.price_new)).filter((n): n is number => n !== null);
  const categories = Array.from(new Set(models.map((m) => m.category).filter(Boolean)));
  const fmt = (n: number) => n.toLocaleString('fr-FR');
  const intro = [
    `${brand} : ${models.length} modèle${models.length > 1 ? 's' : ''} référencé${models.length > 1 ? 's' : ''} sur Moto-Scoot.tn`
      + (ccs.length ? (Math.min(...ccs) === Math.max(...ccs) ? `, en ${Math.min(...ccs)} cm³` : `, de ${Math.min(...ccs)} à ${Math.max(...ccs)} cm³`) : '') + '.',
    prices.length ? (Math.min(...prices) === Math.max(...prices) ? `Prix du neuf : ${fmt(prices[0])} DT.` : `Prix du neuf de ${fmt(Math.min(...prices))} à ${fmt(Math.max(...prices))} DT.`) : '',
    categories.length ? `Catégories : ${categories.join(', ')}.` : '',
  ].filter(Boolean).join(' ');

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Fiches techniques', item: `${SITE}/fiches-techniques` },
      { '@type': 'ListItem', position: 3, name: brand, item: canonical },
    ],
  };
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Fiches techniques ${brand}`,
    numberOfItems: models.length,
    itemListElement: models.map((m, i) => ({ '@type': 'ListItem', position: i + 1, url: modelUrl(m), name: modelName(m) })),
  };

  const items = models.map((m) => {
    const price = parsePrice(m.price_new);
    const facts = [m.year, m.engine?.cc, m.engine?.power, price ? `${fmt(price)} DT` : ''].filter(Boolean).join(' · ');
    return `<li><a href="${modelUrl(m)}">${escapeHtml(modelName(m))}</a>${facts ? ` : ${escapeHtml(String(facts))}` : ''}</li>`;
  }).join('\n');

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

<meta property="og:type" content="website" />
<meta property="og:site_name" content="Moto-Scoot.tn" />
<meta property="og:locale" content="fr_TN" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:secure_url" content="${image}" />
<meta property="og:image:alt" content="${escapeHtml(title)}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${image}" />

<script type="application/ld+json" data-ssr-ld>${scriptSafeJson(breadcrumbLd)}</script>
<script type="application/ld+json" data-ssr-ld>${scriptSafeJson(itemListLd)}</script>
</head>
<body>
<nav aria-label="Fil d'Ariane"><a href="${SITE}/">Accueil</a> › <a href="${SITE}/fiches-techniques">Fiches techniques</a> › ${escapeHtml(brand)}</nav>
<h1>Fiches techniques ${escapeHtml(brand)}</h1>
<p>${escapeHtml(intro)}</p>
<ul>
${items}
</ul>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  res.status(200).send(await renderWithApp(req, html));
}

// /prix/scooter-125-tunisie: the price guide generated from the sheets
// (utils/scooter125Guide.ts, same rows and text as the React page).
// Every sheet sold in Tunisia (brand list, then each brand's models), as the
// React pages load it (useCatalogTechSpecs({ availableInTunisia: true })).
async function fetchTunisiaCatalogue(): Promise<Doc[]> {
  const visible = 'available_in_tunisia=true';
  const brandsRes = await fetch(`${API_BASE}/tech-specs/brands?${visible}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
  if (!brandsRes.ok) throw new Error('Content service unavailable');
  const brandsData = await brandsRes.json();
  const brands = (Array.isArray(brandsData) ? brandsData : brandsData.brands || [])
    .map((b: any) => String(typeof b === 'string' ? b : b.brand || b.name || '')).filter(Boolean);
  const lists = await Promise.all(brands.map(async (brand: string) => {
    const r = await fetch(`${API_BASE}/tech-specs/brands/${encodeURIComponent(brand)}?${visible}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error('Content service unavailable');
    const data = await r.json();
    return (Array.isArray(data) ? data : data.models || []) as Doc[];
  }));
  return lists.flat();
}

// "Modèles similaires" of a sheet; none (section left out) when the catalogue is unavailable.
async function similarModelsFor(d: Doc): Promise<SimilarModel[]> {
  try {
    const catalogue = await fetchTunisiaCatalogue();
    const source = (m: Doc) => ({ id: m.id, slug: (m as any).slug, brand: m.brand, model: m.model, category: m.category, cc: m.engine?.cc, price: m.price_new });
    return similarTechSpecs(source(d), catalogue.map(source));
  } catch {
    return [];
  }
}

async function renderScooter125(req: any, res: any) {
  const now = new Date();
  const rows = scooter125Rows((await fetchTunisiaCatalogue()).map(scooter125SourceFromApi));
  const canonical = `${SITE}${SCOOTER_125_PATH}`;
  const title = `${scooter125Title(now)} | Moto-Scoot.tn`;
  const description = scooter125Description(rows, now);
  const heading = scooter125Heading(now);
  const ficheUrl = (r: Scooter125Row) => `${SITE}/fiche-technique/${r.slug || `${slugify([r.brand, r.model, r.year].filter(Boolean).join(' '))}-${r.id}`}`;
  const usedUrl = `${SITE}/annonces?type=Scooter&maxCC=125`;
  const image = rows.find((r) => r.image)?.image;
  const ogImage = image ? rewriteImageHost(image, rows.find((r) => r.image)?.name) : DEFAULT_OG;

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Fiches techniques', item: `${SITE}/fiches-techniques` },
      { '@type': 'ListItem', position: 3, name: SCOOTER_125_BREADCRUMB, item: canonical },
    ],
  };
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: heading,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: rows.length,
    itemListElement: rows.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.name, url: ficheUrl(r) })),
  };

  const e = (v: unknown) => escapeHtml(String(v ?? ''));
  const table = rows.length ? `<table>
<caption>Prix des scooters 125 neufs en Tunisie</caption>
<thead><tr><th scope="col">Modèle</th><th scope="col">Année</th><th scope="col">Prix neuf</th><th scope="col">Puissance</th><th scope="col">Poids</th><th scope="col">Importateur</th></tr></thead>
<tbody>
${rows.map((r) => `<tr><th scope="row"><a href="${ficheUrl(r)}">${e(r.name)}</a></th><td>${e(r.year ?? '—')}</td><td>${e(fmtDt(r.price))}</td><td>${e(fmtCh(r.powerCh))}</td><td>${e(fmtKg(r.weightKg))}</td><td>${e(r.importer || '—')}</td></tr>`).join('\n')}
</tbody>
</table>` : '';
  const bands = scooter125Bands(rows).map((b) => `<h2>${e(b.title)}</h2>
<p>${e(b.intro)}</p>${b.rows.length ? `\n<ul>${b.rows.map((r) => `<li><a href="${ficheUrl(r)}">${e(r.name)}</a> : ${e(fmtDt(r.price))}</li>`).join('')}</ul>` : ''}`).join('\n');
  const advice = scooter125Advice(rows).map((a) => `<h3>${e(a.title)}</h3>\n<p>${e(a.text)}</p>`).join('\n');
  const faq = scooter125Faq(rows).map((f) => `<h3>${e(f.question)}</h3>\n<p>${e(f.answer)}</p>`).join('\n');
  const brandLinks = [...new Set(rows.map((r) => r.brand))].sort((x, y) => x.localeCompare(y, 'fr'))
    .map((b) => `<li><a href="${SITE}/fiches-techniques/${slugify(b)}">Fiches techniques ${e(b)}</a></li>`).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${e(title)}</title>
<meta name="description" content="${e(description)}" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
<link rel="canonical" href="${canonical}" />
<link rel="alternate" href="${canonical}" hreflang="fr-TN" />
<link rel="alternate" href="${canonical}" hreflang="x-default" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="Moto-Scoot.tn" />
<meta property="og:locale" content="fr_TN" />
<meta property="og:title" content="${e(title)}" />
<meta property="og:description" content="${e(description)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${ogImage}" />
<meta property="og:image:secure_url" content="${ogImage}" />
<meta property="og:image:alt" content="${e(heading)}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${e(title)}" />
<meta name="twitter:description" content="${e(description)}" />
<meta name="twitter:image" content="${ogImage}" />

<script type="application/ld+json" data-ssr-ld>${scriptSafeJson(breadcrumbLd)}</script>
${rows.length ? `<script type="application/ld+json" data-ssr-ld>${scriptSafeJson(itemListLd)}</script>` : ''}
</head>
<body>
<nav aria-label="Fil d'Ariane"><a href="${SITE}/">Accueil</a> › <a href="${SITE}/fiches-techniques">Fiches techniques</a> › ${e(SCOOTER_125_BREADCRUMB)}</nav>
<h1>${e(heading)}</h1>
<p>${e(scooter125Intro(rows, now))}</p>
${table}
<p><a href="${SITE}/comparateur">Comparer 2 modèles</a> · <a href="${usedUrl}">Voir les scooters 125 d'occasion</a></p>
${bands}
<h2>Comment choisir son scooter 125 en Tunisie</h2>
${advice}
<h2>Neuf ou occasion ?</h2>
<p>Un scooter 125 d'occasion coûte moins cher qu'un neuf, mais vérifiez l'entretien, le kilométrage et les papiers avant d'acheter. Les annonces Moto-Scoot.tn regroupent les scooters vendus par des particuliers et des professionnels partout en Tunisie. <a href="${usedUrl}">Voir les annonces</a></p>
${faq ? `<h2>Questions fréquentes</h2>\n${faq}` : ''}
<h2>Comment ces prix sont établis</h2>
<p>${e(scooter125Method(now))}</p>
${brandLinks ? `<ul>${brandLinks}<li><a href="${SITE}/fiches-techniques">Toutes les marques</a></li></ul>` : ''}
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  res.status(200).send(await renderWithApp(req, html));
}

// Crawler-only links for an article or guide: same category first, then the
// most recent, never the page itself nor thin (noindex) entries. An API
// failure only drops the block.
async function relatedLinksHtml(kind: 'article' | 'guide', doc: Doc): Promise<string> {
  const endpoint = kind === 'article' ? 'articles' : 'tips';
  try {
    const r = await fetch(`${API_BASE}/${endpoint}?limit=20`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(4000) });
    if (!r.ok) return '';
    const data = await r.json();
    const rows: Doc[] = Array.isArray(data) ? data : data[endpoint] || [];
    const pool = rows.filter((x) => x.id && x.title && String(x.id) !== String(doc.id) && !isThinContent(String(x.content || x.body || '')));
    const picked = [...pool.filter((x) => x.category && x.category === doc.category), ...pool.filter((x) => !x.category || x.category !== doc.category)].slice(0, 3);
    if (!picked.length) return '';
    const items = picked.map((x) => `<li><a href="${SITE}/${kind}/${slugify(x.title || '')}-${x.id}">${escapeHtml(x.title || '')}</a></li>`).join('\n');
    return `<section>\n<h2>${kind === 'article' ? 'À lire aussi' : 'Autres conseils'}</h2>\n<ul>\n${items}\n</ul>\n</section>`;
  } catch {
    return '';
  }
}

export default async function handler(req: any, res: any) {
  try {
    const kind = String(req.query?.kind || '').toLowerCase() as Kind;
    const slugid = String(req.query?.slugid || '');
    if ((kind as string) === 'prix' && `/prix/${slugid.replace(/\/$/, '')}` === SCOOTER_125_PATH) {
      await renderScooter125(req, res);
      return;
    }
    if ((kind as string) === 'marque' && /^[a-z0-9-]+$/.test(slugid.replace(/\/$/, ''))) {
      await renderBrand(req, res, slugid.replace(/\/$/, ''));
      return;
    }
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
      res.status(404).send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8" /><title>Page introuvable | Moto-Scoot.tn</title><meta name="robots" content="noindex" /></head><body><h1>Page introuvable</h1><p><a href="${SITE}/">Retour à l'accueil</a></p></body></html>`);
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
      if (doc?.brand) breadcrumbs.push({ '@type': 'ListItem', position: 3, name: doc.brand, item: `${SITE}/fiches-techniques/${slugify(String(doc.brand))}` });
    } else if (kind === 'article') {
      breadcrumbs.push({ '@type': 'ListItem', position: 2, name: 'Actualités', item: `${SITE}/actualites` });
    } else if (kind === 'guide') {
      breadcrumbs.push({ '@type': 'ListItem', position: 2, name: 'Conseils', item: `${SITE}/conseils` });
    } else if (kind === 'garage') {
      breadcrumbs.push({ '@type': 'ListItem', position: 2, name: 'Garages', item: `${SITE}/garages` });
    }
    const heading = kind === 'fiche-technique'
      ? [doc.brand, doc.model].filter(Boolean).join(' ') || title
      : doc.title || doc.name || title;
    breadcrumbs.push({ '@type': 'ListItem', position: breadcrumbs.length + 1, name: heading, item: canonical });
    const breadcrumbLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs,
    };

    const price = kind === 'fiche-technique' ? parsePrice(doc?.price_new) : null;


    const thin = (kind === 'article' || kind === 'guide') && isThinContent(String(doc.content || doc.body || ''));
    const related = kind === 'article' || kind === 'guide' ? await relatedLinksHtml(kind, doc) : '';
    const similar = kind === 'fiche-technique' ? await similarModelsFor(doc) : [];
    const robots = kind === 'garage' && !GARAGES_PUBLIC ? GARAGES_ROBOTS
      : thin ? THIN_CONTENT_ROBOTS
      : 'index, follow, max-image-preview:large, max-snippet:-1';
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="robots" content="${robots}" />
<link rel="canonical" href="${canonical}" />
<link rel="alternate" href="${canonical}" hreflang="fr-TN" />
<link rel="alternate" href="${canonical}" hreflang="x-default" />

<meta property="og:type" content="${ogType}" />
${ogType === 'article' && doc ? [
  doc.published_at || doc.created_at ? `<meta property="article:published_time" content="${escapeHtml(String(doc.published_at || doc.created_at))}" />` : '',
  doc.updated_at ? `<meta property="article:modified_time" content="${escapeHtml(String(doc.updated_at))}" />` : '',
  doc.category ? `<meta property="article:section" content="${escapeHtml(String(doc.category))}" />` : '',
].filter(Boolean).join('\n') : ''}
<meta property="og:site_name" content="Moto-Scoot.tn" />
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

${ld ? `<script type="application/ld+json" data-ssr-ld>${scriptSafeJson(ld)}</script>` : ''}
<script type="application/ld+json" data-ssr-ld>${scriptSafeJson(breadcrumbLd)}</script>
</head>
<body>
${kind === 'article' || kind === 'guide' ? `<nav aria-label="Fil d'Ariane"><a href="${SITE}/">Accueil</a> › <a href="${SITE}/${kind === 'article' ? 'actualites' : 'conseils'}">${kind === 'article' ? 'Actualités' : 'Conseils'}</a> › ${escapeHtml(heading)}</nav>` : ''}
${kind === 'fiche-technique' ? renderFicheBody(doc, similar) : `<h1>${escapeHtml(heading)}</h1>
<p>${escapeHtml(description)}</p>
${(() => {
  const body = crawlerBodyHtml(String(doc.content || doc.body || doc.description || ''));
  return body ? `<article>\n${body}\n</article>` : '';
})()}`}
${related}
${kind === 'garage' ? (doc.reviews || []).map(review => `<section><h2>${escapeHtml(review.author_name || 'Utilisateur')}</h2><p>${escapeHtml(String(review.rating || ''))} / 5</p><p>${escapeHtml(review.content || '')}</p></section>`).join('') : ''}
${image && image !== DEFAULT_OG ? `<img src="${image}" alt="${escapeHtml(title)}" loading="lazy" />` : ''}
<p><a href="${canonical}">Voir sur Moto-Scoot.tn</a></p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (kind === 'garage' && !GARAGES_PUBLIC) res.setHeader('X-Robots-Tag', GARAGES_ROBOTS);
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    res.status(200).send(await renderWithApp(req, html));
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Retry-After', '60');
    res.status(503).setHeader('Content-Type', 'text/html; charset=utf-8').send('<!doctype html><html lang="fr"><head><title>Page temporairement indisponible | Moto-Scoot.tn</title><meta name="robots" content="noindex"></head><body><h1>Page temporairement indisponible</h1><p>Veuillez réessayer dans quelques instants.</p></body></html>');
  }
}
