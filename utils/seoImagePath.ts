import { slugify } from './slugify.js';

/**
 * Cache version added to the photo addresses the server writes for previews
 * (WhatsApp, Facebook) and Google's data, on every page type. Bumped when the
 * CDN holds a bad copy of the bare photo addresses (5 Nov 2026: partial
 * "Range" replies cached as the whole photo for 30 days). A new value is a
 * new cache key, so previews and Google fetch the full photo again.
 */
export const IMAGE_CACHE_VERSION = '2';

const SITE_ORIGIN = 'https://www.moto-scoot.tn';
const UPLOAD_HOSTS = new Set([
  'www.moto-scoot.tn', 'moto-scoot.tn',
  'motoscoot.ihebchebbi.pro', 'www.motoscoot.ihebchebbi.pro',
]);

/** Only the two file paths served by the /m/ proxy are eligible. */
function uploadMediaPath(url: string, cleanSlug: string): string | null {
  if (!url || !cleanSlug) return null;
  try {
    const source = new URL(url, url.startsWith('/') ? SITE_ORIGIN : undefined);
    if (!/^https?:$/.test(source.protocol) || !UPLOAD_HOSTS.has(source.host)) return null;
    const match = /^\/uploads\/(thumbnails\/)?([^/]+)$/.exec(source.pathname);
    if (!match) return null;
    return `/m/${cleanSlug}/${match[1] ? 't/' : ''}${match[2]}`;
  } catch {
    return null;
  }
}

/** Browser gallery paths have a 60-character slug. */
export function seoImagePath(url: string, slug?: string | null): string | null {
  const path = uploadMediaPath(url, slug ? slugify(slug).slice(0, 60) : '');
  if (!path) return null;
  return url.startsWith('/uploads/') ? path + (url.match(/[?#].*$/)?.[0] || '') : path;
}

/** Public metadata uses a versioned absolute URL for a Moto-Scoot upload. */
export function rewriteImageHost(url: string, slug?: string | null): string {
  if (!url) return url;
  const path = uploadMediaPath(url, slug ? slugify(slug) : '');
  if (path) return `${SITE_ORIGIN}${path}?v=${IMAGE_CACHE_VERSION}`;
  return url.replace(/^http:\/\//i, 'https://')
    .replace(/^https:\/\/(?:www\.)?motoscoot\.ihebchebbi\.pro\//i, `${SITE_ORIGIN}/`);
}

export function optimizeImageSource(resolved: string, width: number, height: number, quality: number): string {
  if (!/^(?:https?:)?\/\//i.test(resolved)) return resolved;
  let host: string;
  try {
    host = new URL(resolved, SITE_ORIGIN).hostname;
  } catch {
    return resolved;
  }
  if (host === 'unsplash.com' || host.endsWith('.unsplash.com')) {
    const baseUrl = resolved.split('?')[0];
    return `${baseUrl}?auto=format&fit=crop&w=${width}&h=${height}&q=${quality}`;
  }

  const isInternal = host === 'magma-studio.tn' || host.endsWith('.magma-studio.tn') || host === 'www.moto-scoot.tn';
  if (isInternal) {
    const sep = resolved.includes('?') ? '&' : '?';
    return `${resolved}${sep}tr=w-${width},h-${height},q-${quality},c-cover`;
  }

  return resolved;
}

/** Shared by the main gallery image and its preload in the initial HTML. */
export function galleryImageUrl(url: string, title: string): string {
  return optimizeImageSource(seoImagePath(url, title) ?? url, 1200, 900, 90);
}
