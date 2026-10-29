export const slugify = (text: string): string => {
  if (!text) return 'details';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
};

// Branded fallback images (orange theme) generated for the marketplace.
// Imported as ES modules so Vite hashes & ships them with the bundle.
// Use a relative import (not the @/ alias) so resolution works even when
// Vite's alias index is out of sync with newly-added asset files.
import placeholderListing from '../assets/placeholder-listing.jpg';
import placeholderGarage from '../assets/placeholder-garage.jpg';
import placeholderAvatar from '../assets/placeholder-avatar.jpg';
import { API_BASE_URL } from '../services/apiClient';

export const PLACEHOLDER_LISTING = placeholderListing;
export const PLACEHOLDER_GARAGE = placeholderGarage;
export const PLACEHOLDER_AVATAR = placeholderAvatar;

/**
 * Derive the API origin (scheme + host) from API_BASE_URL.
 * API_BASE_URL ends with "/api" — strip it so we can prefix "/uploads/...".
 * Falls back to empty string in non-browser contexts.
 */
const API_ORIGIN: string = (() => {
  try {
    const u = new URL(API_BASE_URL, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
})();

/**
 * Resolve a backend-relative upload URL ("/uploads/xyz.webp") to an absolute
 * URL pointing at the API host. The backend persists relative URLs on purpose
 * (so links survive host changes), so the frontend MUST prefix them at render
 * time — otherwise the browser resolves them against the frontend origin and
 * gets a 404. Already-absolute URLs are returned unchanged.
 */
export const resolveUploadUrl = (url: string): string => {
  if (!url || typeof url !== 'string') return url;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith('/uploads/')) return `${API_ORIGIN}${url}`;
  return url;
};

/**
 * SEO-friendly image URL.
 *
 * Rewrites backend upload URLs (whether stored as "/uploads/<file>" or as the
 * absolute API host) to a frontend-served path that embeds a human-readable
 * slug derived from the listing/article/garage title:
 *
 *   /m/<slug>/<file>.webp           (main image)
 *   /m/<slug>/t/<file>.webp         (thumbnail)
 *
 * The actual bytes are still served by the Node backend — Vercel + Vite
 * proxy `/m/*` straight through to `/uploads/*`. Crawlers see a descriptive
 * URL on our own domain, which is the SEO win the customer asked for.
 *
 * Falls back to the original URL when no slug is provided, when the URL is
 * external (Unsplash, etc.), or when it's already a data:/blob: URI.
 */
export const buildSeoImageUrl = (url: string, slug?: string | null): string => {
  if (!url || typeof url !== 'string') return url;
  if (/^(data:|blob:)/i.test(url)) return url;
  const cleanSlug = slug ? slugify(String(slug)).slice(0, 60) : '';
  if (!cleanSlug) return resolveUploadUrl(url);

  // Pull out the "/uploads/..." portion regardless of whether the stored URL
  // is relative or absolute (different envs / legacy data).
  let path: string | null = null;
  if (url.startsWith('/uploads/')) {
    path = url;
  } else {
    const m = url.match(/\/uploads\/([^?#]+)/i);
    if (m) path = `/uploads/${m[1]}`;
  }
  if (!path) return url; // external URL — leave alone

  const rest = path.replace(/^\/uploads\//, '');
  if (rest.startsWith('thumbnails/')) {
    return `/m/${cleanSlug}/t/${rest.slice('thumbnails/'.length)}`;
  }
  return `/m/${cleanSlug}/${rest}`;
};

export const getOptimizedImageUrl = (
  url: string,
  width = 800,
  height = 600,
  quality = 80,
  fallback: string = placeholderListing,
  /** Optional SEO slug (listing title, model name, garage name…). When
   *  provided, rewrites backend uploads to /m/<slug>/<file> on this origin. */
  seoSlug?: string | null,
): string => {
  if (!url || typeof url !== 'string') return fallback;

  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  const resolved = seoSlug ? buildSeoImageUrl(url, seoSlug) : resolveUploadUrl(url);

  if (resolved.includes('unsplash.com')) {
    const baseUrl = resolved.split('?')[0];
    return `${baseUrl}?auto=format&fit=crop&w=${width}&h=${height}&q=${quality}`;
  }

  if (resolved.includes('placehold.co')) {
    return resolved;
  }

  const isInternal = resolved.includes('magma-studio.tn') || resolved.includes('www.moto-scoot.tn');
  if (isInternal) {
    const sep = resolved.includes('?') ? '&' : '?';
    return `${resolved}${sep}tr=w-${width},h-${height},q-${quality},c-cover`;
  }

  return resolved;
};

import { getListingNumber, getSpecSlug } from './publicIds';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteMapping {
  view: string;
  path: string;
  pattern: RegExp;
}

const ROUTE_MAP: RouteMapping[] = [
  { view: 'home', path: '/', pattern: /^\/$/ },
  { view: 'search', path: '/annonces', pattern: /^\/annonces/ },
  { view: 'news', path: '/actualites', pattern: /^\/actualites/ },
  { view: 'garages', path: '/garages', pattern: /^\/garages/ },
  { view: 'tips', path: '/conseils', pattern: /^\/conseils/ },
  { view: 'contact', path: '/contact', pattern: /^\/contact/ },
  { view: 'faq', path: '/faq', pattern: /^\/faq/ },
  { view: 'about', path: '/a-propos', pattern: /^\/a-propos/ },
  { view: 'favorites', path: '/mes-favoris', pattern: /^\/mes-favoris/ },
  { view: 'deposit', path: '/deposer-une-annonce', pattern: /^\/deposer-une-annonce/ },
  // edit-listing MUST come before the dashboard pattern, which greedily
  // matches any /mon-compte/* path.
  { view: 'edit-listing', path: '/mon-compte/annonce', pattern: /^\/mon-compte\/annonce\/([0-9a-zA-Z-]+)\/modifier\/?$/ },
  { view: 'dashboard', path: '/mon-compte', pattern: /^\/mon-compte/ },
  { view: 'dashboard-pro', path: '/espace-pro', pattern: /^\/espace-pro/ },
  { view: 'admin', path: '/admin', pattern: /^\/admin/ },
  { view: 'tech-specs-brands', path: '/fiches-techniques', pattern: /^\/fiches-techniques$/ },
  { view: 'comparator', path: '/comparateur', pattern: /^\/comparateur\/?$/ },
  { view: 'legal', path: '/mentions-legales', pattern: /^\/mentions-legales\/?$/ },
  { view: 'security', path: '/securite', pattern: /^\/securite\/?$/ },
  { view: 'terms', path: '/conditions', pattern: /^\/conditions\/?$/ },
  { view: 'cookies', path: '/cookies', pattern: /^\/cookies\/?$/ },
  { view: 'sitemap', path: '/plan-du-site', pattern: /^\/plan-du-site\/?$/ },
  // IDs may be numeric (legacy) or UUIDs (Postgres uuid_generate_v4).
  // The id segment is everything after the last "-" in the slug-id tail.
  { view: 'listing-details', path: '/annonce', pattern: /^\/annonce\/[a-z0-9-]+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)\/?$/i },
  { view: 'article-details', path: '/article', pattern: /^\/article\/[a-z0-9-]+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i },
  { view: 'tip-details', path: '/guide', pattern: /^\/guide\/[a-z0-9-]+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i },
  { view: 'garage-details', path: '/garage', pattern: /^\/garage\/[a-z0-9-]+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i },
  // Legacy long form (slug + UUID) first, then the short slug-only form.
  { view: 'tech-specs-details', path: '/fiche-technique', pattern: /^\/fiche-technique\/[a-z0-9-]+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i },
  { view: 'tech-specs-details', path: '/fiche-technique', pattern: /^\/fiche-technique\/([a-z0-9-]+)\/?$/ },
  { view: 'tech-specs-models', path: '/fiches-techniques', pattern: /^\/fiches-techniques\/([a-z0-9-]+)$/ },
  { view: 'api-test', path: '/test', pattern: /^\/test\/?$/ },
  { view: 'reset-password', path: '/reinitialiser-mot-de-passe', pattern: /^\/reinitialiser-mot-de-passe\/?$/ },
];

export const encodeQueryParams = (params: Record<string, any>): string => {
  const searchParams = new URLSearchParams();
  // Keys that are part of the path (slug/id) and must NOT be serialized as
  // query string. NOTE: 'brand' is intentionally NOT in this list — it's only
  // used as a path segment for tech-specs pages, while it's a real FILTER on
  // the /annonces (search) view. Stripping it here was dropping the brand
  // filter every time the URL was updated.
  // NOTE: 'model' is intentionally NOT in this list — it's a real FILTER on
  // /annonces. The slug source for tech-specs URLs is the explicit `slug`
  // param (added by TechSpecsModels) and `specId` is the path id.
  const PATH_KEYS = new Set(['view', 'id', 'specId', 'title', 'name', 'slug']);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null && !PATH_KEYS.has(key)) {
      if (Array.isArray(value)) {
        if (value.length > 0) searchParams.set(key, value.join(','));
      } else {
        const str = String(value);
        // Skip "all" sentinel values to keep URLs clean.
        if (
          str === 'Tous les types' ||
          str === 'Toutes les marques' ||
          str === 'Tous les modèles' ||
          str === 'Toutes les villes'
        ) return;
        searchParams.set(key, str);
      }
    }
  });
  const str = searchParams.toString();
  return str ? `?${str}` : '';
};

export const decodeQueryParams = (queryString: string): Record<string, any> => {
  const params = new URLSearchParams(queryString);
  const result: Record<string, any> = {};
  
  params.forEach((value, key) => {
    if (['minPrice', 'maxPrice', 'minYear', 'maxYear', 'minKm', 'maxKm', 'minCC', 'maxCC', 'id'].includes(key)) {
      result[key] = Number(value);
    } else if (key === 'aroundMe' || key === 'onlyPro' || key === 'available_in_tunisia' || key === 'availableInTunisia') {
      result[key] = value === 'true';
    } else if (key === 'conditions') {
      result[key] = value.split(',');
    } else {
      result[key] = value;
    }
  });
  
  return result;
};

export const getUrlFromState = (view: string, params: any = {}): string => {
  // Prefer an explicit `slug` provided by the caller (tech-specs models pass
  // a "<brand>-<model>-<year>" slug). Fall back to title/name/model so legacy
  // callers (listings, articles, …) keep producing the same URLs.
  const slug =
    params.slug || params.title || params.name || params.model || 'details';
  const id = params.id;
  const brand = params.brand;

  let path = '/';
  switch (view) {
    case 'home': path = '/'; break;
    case 'search': path = '/annonces'; break;
    case 'news': path = '/actualites'; break;
    case 'garages': path = '/garages'; break;
    case 'tips': path = '/conseils'; break;
    case 'contact': path = '/contact'; break;
    case 'faq': path = '/faq'; break;
    case 'about': path = '/a-propos'; break;
    case 'favorites': path = '/mes-favoris'; break;
    case 'deposit': path = '/deposer-une-annonce'; break;
    case 'dashboard': path = '/mon-compte'; break;
    case 'dashboard-pro': path = '/espace-pro'; break;
    case 'admin': path = '/admin'; break;
    case 'tech-specs-brands': path = '/fiches-techniques'; break;
    case 'comparator': path = '/comparateur'; break;
    case 'legal': path = '/mentions-legales'; break;
    case 'security': path = '/securite'; break;
    case 'terms': path = '/conditions'; break;
    case 'cookies': path = '/cookies'; break;
    case 'sitemap': path = '/plan-du-site'; break;
    case 'listing-details': path = `/annonce/${slugify(slug)}-${params.listingNumber ?? getListingNumber(id) ?? id}`; break;
    case 'article-details': path = `/article/${slugify(slug)}-${id}`; break;
    case 'tip-details': path = `/guide/${slugify(slug)}-${id}`; break;
    case 'garage-details': path = `/garage/${slugify(slug)}-${id}`; break;
    case 'tech-specs-details': {
      const short = params.specSlug || getSpecSlug(id) || (typeof id === 'string' && !UUID_RE.test(id) ? id : undefined);
      path = short ? `/fiche-technique/${short}` : `/fiche-technique/${slugify(slug)}-${id}`;
      break;
    }
    case 'tech-specs-models': path = `/fiches-techniques/${slugify(brand)}`; break;
    case 'api-test': path = '/test'; break;
    case 'reset-password': path = '/reinitialiser-mot-de-passe'; break;
    case 'edit-listing': path = `/mon-compte/annonce/${id}/modifier`; break;
    default: path = '/';
  }

  // On ajoute les paramètres de requête pour les vues qui en dépendent (filtres ou onglets ou IDs de comparaison)
  if (['search', 'dashboard', 'dashboard-pro', 'comparator'].includes(view)) {
    return `${path}${encodeQueryParams(params)}`;
  }

  // tech-specs-models uses `brand` as a path segment — strip it from query.
  if (view === 'tech-specs-models') {
    const { brand: _b, ...rest } = params || {};
    return `${path}${encodeQueryParams(rest)}`;
  }

  if (view === 'tech-specs-brands') {
    return `${path}${encodeQueryParams(params)}`;
  }

  return path;
};

export const getStateFromUrl = (pathname: string = window.location.pathname, search: string = window.location.search) => {
  const normalizedPath = (pathname || '/').replace(/\/+$/, '') || '/';
  
  const queryParams = search ? decodeQueryParams(search) : {};
  
  for (const route of ROUTE_MAP) {
    const match = normalizedPath.match(route.pattern);
    if (match) {
      const state: any = { ...queryParams, view: route.view };
      if (match[1]) {
        if (route.view === 'tech-specs-models') {
          state.brand = match[1];
        } else {
          // Preserve UUIDs as strings; only coerce pure-numeric ids to number
          // for backwards compatibility with old integer-keyed code paths.
          const raw = match[1];
          if (/^\d+$/.test(raw)) {
            state.id = parseInt(raw, 10);
          } else {
            state.id = raw;
          }
        }
      }
      return state;
    }
  }
  
  return { view: 'not-found' };
};