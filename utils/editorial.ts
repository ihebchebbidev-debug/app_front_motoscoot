/**
 * Articles and guides (/article/*, /guide/*) under THIN_CONTENT_WORDS words
 * are served "noindex, follow" and left out of the sitemap until they are
 * rewritten; they become indexable again on their own once long enough.
 * Keep the threshold in sync with BackendNodeJs/src/routes/sitemap.js.
 */
export const THIN_CONTENT_WORDS = 300;
export const THIN_CONTENT_ROBOTS = 'noindex, follow';

const WORDS_PER_MINUTE = 200;

export function wordCount(html?: string | null): number {
  const text = String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
  return (text.match(/[\p{L}\p{N}]+/gu) || []).length;
}

export function isThinContent(html?: string | null): boolean {
  return wordCount(html) < THIN_CONTENT_WORDS;
}

/** "N min" from the text; the stored admin value only when no text is loaded. */
export function readingTime(html?: string | null, stored?: string | number | null): string {
  const words = wordCount(html);
  if (words > 0) return `${Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min`;
  return stored ? `${String(stored).replace(/\s*min\s*$/i, '')} min` : '';
}
