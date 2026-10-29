
import React, { useEffect } from 'react';
import { useSeoSettings } from '../../hooks/useSeoSettings';

interface BreadcrumbItem {
  name: string;
  url: string; // absolute or path
}

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  /** Provide either a relative path (e.g. /annonce/xxx) or absolute URL. */
  url?: string;
  type?: 'website' | 'article' | 'product';
  schema?: object | object[];
  /** Page-specific keywords appended to the global ones. */
  keywords?: string[];
  /** Set false on private/duplicate-y pages (search filters, dashboards). */
  noIndex?: boolean;
  /** Renders a BreadcrumbList JSON-LD automatically. */
  breadcrumbs?: BreadcrumbItem[];
  /** For type="article": ISO publish date — used by article:published_time. */
  publishedTime?: string;
  /** For type="article": ISO modified date — used by article:modified_time. */
  modifiedTime?: string;
  /** Pagination: previous page URL (relative or absolute). Emits <link rel="prev">. */
  prevUrl?: string;
  /** Pagination: next page URL (relative or absolute). Emits <link rel="next">. */
  nextUrl?: string;
}

const SITE_ORIGIN = 'https://www.moto-scoot.tn';
const DEFAULT_OG = 'https://www.moto-scoot.tn/og-banner.webp';
const SITE_NAME = 'MotoScoot.tn';
const BRAND_NAME = 'MotoScoot';

// Strip noisy tracking params from canonical URLs so Google doesn't see
// dozens of "duplicate" pages (utm_*, fbclid, gclid, ref, etc.).
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ref', 'mc_cid', 'mc_eid', '_ga', 'igshid',
]);

const cleanCanonical = (rawUrl: string): string => {
  try {
    const u = new URL(rawUrl, SITE_ORIGIN);
    // Force production host so dev/preview don't pollute the canonical.
    u.protocol = 'https:';
    u.host = new URL(SITE_ORIGIN).host;
    // Drop trailing slash (except root) for consistency.
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }
    // Drop the SPA hash — never canonical.
    u.hash = '';
    // Drop tracking params.
    [...u.searchParams.keys()].forEach((k) => {
      if (TRACKING_PARAMS.has(k.toLowerCase())) u.searchParams.delete(k);
    });
    return u.toString();
  } catch {
    return rawUrl;
  }
};

const toAbsolute = (path: string): string => {
  if (!path) return SITE_ORIGIN;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
};

const SEO: React.FC<SEOProps> = ({
  title,
  description,
  image,
  url,
  type = 'website',
  schema,
  keywords,
  noIndex = false,
  breadcrumbs,
  publishedTime,
  modifiedTime,
  prevUrl,
  nextUrl,
}) => {
  const { data: seo } = useSeoSettings();

  // Apply admin-controlled defaults: title template, fallback description, OG image.
  const template = (seo?.title_template && seo.title_template.includes('%s'))
    ? seo.title_template
    : `%s | ${BRAND_NAME}`;
  const fallbackTitle = seo?.default_title || "Motos et Scooters en Tunisie | Neufs & Occasion";
  const fullTitle = title ? template.replace('%s', title) : fallbackTitle;
  const defaultDescription = seo?.default_description
    || "Trouvez, vendez et comparez des motos et scooters en Tunisie : annonces neuves et d'occasion, prix, fiches techniques et nouveautés du marché.";
  const finalDescription = (description || defaultDescription).slice(0, 160);
  const rawUrl = url
    ? toAbsolute(url)
    : (typeof window !== 'undefined' ? `${SITE_ORIGIN}${window.location.pathname}${window.location.search}` : SITE_ORIGIN);
  const finalUrl = cleanCanonical(rawUrl);
  // Always force og:image to an absolute https URL — FB/LinkedIn/WhatsApp
  // scrapers reject relative paths and silently fall back to the default
  // banner, which kills the per-page share preview the user expects.
  const finalImage = toAbsolute(image || seo?.default_og_image || DEFAULT_OG);
  const twitterHandle = seo?.twitter_handle || '@motoscoot_tn';

  useEffect(() => {
    document.title = fullTitle;

    const upsertMeta = (selector: string, attr: string, attrValue: string, contentAttr: string, contentValue: string) => {
      let el = document.querySelector(selector) as HTMLElement | null;
      if (!el) {
        el = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
        el.setAttribute(attr, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute(contentAttr, contentValue);
    };

    upsertMeta('meta[name="description"]', 'name', 'description', 'content', finalDescription);

    // Robots — let private/duplicate pages opt out cleanly.
    upsertMeta(
      'meta[name="robots"]',
      'name',
      'robots',
      'content',
      noIndex
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    );

    // Keywords (page-specific). Kept short — Google ignores it but Bing/others still read it.
    if (keywords && keywords.length) {
      upsertMeta('meta[name="keywords"]', 'name', 'keywords', 'content', keywords.join(', '));
    }

    // Open Graph
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', 'content', fullTitle);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', 'content', finalDescription);
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', 'content', finalImage);
    upsertMeta('meta[property="og:image:secure_url"]', 'property', 'og:image:secure_url', 'content', finalImage);
    // Recommended dimensions so FB/LinkedIn pre-render the large card without
    // having to fetch the image first (avoids the "small thumbnail" fallback
    // on first share before the scraper has cached the asset).
    upsertMeta('meta[property="og:image:width"]', 'property', 'og:image:width', 'content', '1200');
    upsertMeta('meta[property="og:image:height"]', 'property', 'og:image:height', 'content', '630');
    upsertMeta('meta[property="og:image:type"]', 'property', 'og:image:type', 'content', /\.png(\?|$)/i.test(finalImage) ? 'image/png' : 'image/jpeg');
    upsertMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', 'content', title || SITE_NAME);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', 'content', finalUrl);
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'content', type);
    upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', 'content', SITE_NAME);
    upsertMeta('meta[property="og:locale"]', 'property', 'og:locale', 'content', 'fr_TN');

    // Article-specific OG (only emitted when relevant)
    if (type === 'article' && publishedTime) {
      upsertMeta('meta[property="article:published_time"]', 'property', 'article:published_time', 'content', publishedTime);
    }
    if (type === 'article' && modifiedTime) {
      upsertMeta('meta[property="article:modified_time"]', 'property', 'article:modified_time', 'content', modifiedTime);
    }

    // Twitter / X
    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'content', 'summary_large_image');
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', 'content', fullTitle);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', 'content', finalDescription);
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', 'content', finalImage);
    upsertMeta('meta[name="twitter:image:alt"]', 'name', 'twitter:image:alt', 'content', title || SITE_NAME);
    if (twitterHandle) {
      upsertMeta('meta[name="twitter:site"]', 'name', 'twitter:site', 'content', twitterHandle);
      upsertMeta('meta[name="twitter:creator"]', 'name', 'twitter:creator', 'content', twitterHandle);
    }

    // Google Search Console verification (admin-managed) — site-wide meta.
    if (seo?.gsc_verification_code) {
      upsertMeta('meta[name="google-site-verification"]', 'name', 'google-site-verification', 'content', seo.gsc_verification_code);
    }

    // Canonical + hreflang
    // Not-found / noindex pages must not declare a canonical (soft-404 fix).
    if (noIndex) {
      document.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
    } else {
      upsertMeta('link[rel="canonical"]', 'rel', 'canonical', 'href', finalUrl);
    }
    upsertMeta('link[rel="alternate"][hreflang="fr-TN"]', 'hreflang', 'fr-TN', 'href', finalUrl);
    upsertMeta('link[rel="alternate"][hreflang="x-default"]', 'hreflang', 'x-default', 'href', finalUrl);

    // Pagination link relations. Google deprecated rel=prev/next as a ranking
    // signal but Bing/Yandex/screen readers still consume them, and they help
    // crawlers walk paginated series in order.
    const upsertOrRemoveLink = (rel: 'prev' | 'next', href: string | undefined) => {
      const existing = document.querySelector(`link[rel="${rel}"]`);
      if (!href) {
        existing?.remove();
        return;
      }
      const absolute = cleanCanonical(toAbsolute(href));
      if (existing) {
        existing.setAttribute('href', absolute);
      } else {
        const link = document.createElement('link');
        link.setAttribute('rel', rel);
        link.setAttribute('href', absolute);
        document.head.appendChild(link);
      }
    };
    upsertOrRemoveLink('prev', prevUrl);
    upsertOrRemoveLink('next', nextUrl);

    // ----- JSON-LD -----
    // Page-specific block (Product, Article, FAQPage, etc.)
    const SCRIPT_ID = 'schema-jsonld-page';
    document.getElementById(SCRIPT_ID)?.remove();
    if (schema) {
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.type = 'application/ld+json';
      script.text = JSON.stringify(Array.isArray(schema) ? schema : [schema]);
      document.head.appendChild(script);
    }

    // Breadcrumbs block (managed independently so pages can omit it)
    const CRUMB_ID = 'schema-jsonld-breadcrumbs';
    document.getElementById(CRUMB_ID)?.remove();
    if (breadcrumbs && breadcrumbs.length > 0) {
      const crumbScript = document.createElement('script');
      crumbScript.id = CRUMB_ID;
      crumbScript.type = 'application/ld+json';
      crumbScript.text = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((b, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: b.name,
          item: toAbsolute(b.url),
        })),
      });
      document.head.appendChild(crumbScript);
    }

    // Organization JSON-LD (admin-managed; injected once site-wide).
    const ORG_ID = 'schema-jsonld-organization';
    document.getElementById(ORG_ID)?.remove();
    if (seo?.enable_organization_jsonld !== false && (seo?.organization_name || seo?.organization_logo)) {
      const orgScript = document.createElement('script');
      orgScript.id = ORG_ID;
      orgScript.type = 'application/ld+json';
      const org: any = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: seo?.organization_name || BRAND_NAME,
        url: SITE_ORIGIN,
      };
      if (seo?.organization_logo) org.logo = seo.organization_logo;
      if (seo?.organization_email || seo?.organization_phone) {
        org.contactPoint = {
          '@type': 'ContactPoint',
          contactType: 'customer service',
          ...(seo?.organization_email ? { email: seo.organization_email } : {}),
          ...(seo?.organization_phone ? { telephone: seo.organization_phone } : {}),
          areaServed: 'TN',
          availableLanguage: ['French', 'Arabic'],
        };
      }
      if (seo?.organization_address) org.address = { '@type': 'PostalAddress', addressCountry: 'TN', streetAddress: seo.organization_address };
      orgScript.text = JSON.stringify(org);
      document.head.appendChild(orgScript);
    }
  }, [fullTitle, finalDescription, finalImage, type, finalUrl, schema, keywords, noIndex, breadcrumbs, publishedTime, modifiedTime, prevUrl, nextUrl, twitterHandle, seo?.gsc_verification_code, seo?.organization_name, seo?.organization_logo, seo?.organization_email, seo?.organization_phone, seo?.organization_address, seo?.enable_organization_jsonld]);

  return null;
};

export default SEO;
