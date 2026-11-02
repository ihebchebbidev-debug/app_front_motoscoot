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

/** The page title is the only <h1>: headings typed in the CMS body start at <h2>. */
export function demoteBodyH1(html: string): string {
  return String(html ?? '').replace(/<(\/?)h1\b/gi, '<$1h2');
}

/** Organization node (same @id as index.html) for article author / publisher. */
export const ORGANIZATION_NODE = {
  '@type': 'Organization',
  '@id': 'https://www.moto-scoot.tn/#organization',
  name: 'MotoScoot',
  url: 'https://www.moto-scoot.tn/',
  logo: 'https://www.moto-scoot.tn/site-logo/logo-color.svg',
};

/** CMS author shown as the byline, or null for placeholder accounts. */
export function realAuthorName(name?: string | null): string | null {
  const n = String(name ?? '').trim();
  return n && !/^admin(\s+admin)?$/i.test(n) ? n : null;
}

const decodeEntities = (s: string) =>
  s.replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const escapeText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * CMS body as plain structured HTML for crawlers that do not run JavaScript:
 * headings, paragraphs and list items keep their structure, every piece of
 * text is escaped (no CMS markup or attributes reach the page).
 */
export function crawlerBodyHtml(html?: string | null): string {
  const source = String(html ?? '');
  const out: string[] = [];
  let inList = false;
  for (const m of source.matchAll(/<(h[1-6]|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const tag = m[1].toLowerCase();
    const text = decodeEntities(m[2].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (tag === 'li' && !inList) { out.push('<ul>'); inList = true; }
    if (tag !== 'li' && inList) { out.push('</ul>'); inList = false; }
    const el = tag === 'h1' || tag === 'h2' ? 'h2' : tag.startsWith('h') ? 'h3' : tag === 'li' ? 'li' : 'p';
    out.push(`<${el}>${escapeText(text)}</${el}>`);
  }
  if (inList) out.push('</ul>');
  if (out.length) return out.join('\n');
  const text = decodeEntities(source.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  return text ? `<p>${escapeText(text)}</p>` : '';
}

/** "N min" from the text; the stored admin value only when no text is loaded. */
export function readingTime(html?: string | null, stored?: string | number | null): string {
  const words = wordCount(html);
  if (words > 0) return `${Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min`;
  return stored ? `${String(stored).replace(/\s*min\s*$/i, '')} min` : '';
}
