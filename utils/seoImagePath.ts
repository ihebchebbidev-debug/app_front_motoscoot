import { slugify } from './slugify.js';

/**
 * "/m/<slug>/<file>" (or "/m/<slug>/t/<file>" for thumbnails) for an upload
 * URL, or null when the URL is not a backend upload or there is no slug.
 * Used by buildSeoImageUrl (utils/urlUtils.ts) for every gallery image and by
 * the listing prerender to preload the first one: both must build the same URL.
 */
export function seoImagePath(url: string, slug?: string | null): string | null {
  if (!url || typeof url !== 'string' || /^(data:|blob:)/i.test(url)) return null;
  const cleanSlug = slug ? slugify(String(slug)).slice(0, 60) : '';
  if (!cleanSlug) return null;
  // Pull out the "/uploads/..." portion regardless of whether the stored URL
  // is relative or absolute (different envs / legacy data).
  const m = url.startsWith('/uploads/') ? [url, url.slice('/uploads/'.length)] : url.match(/\/uploads\/([^?#]+)/i);
  if (!m) return null;
  const rest = m[1];
  if (rest.startsWith('thumbnails/')) return `/m/${cleanSlug}/t/${rest.slice('thumbnails/'.length)}`;
  return `/m/${cleanSlug}/${rest}`;
}
