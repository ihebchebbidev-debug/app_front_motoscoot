/** URL slug shared by every internal link (see utils/urlUtils.ts). */
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
    .replace(/--+/g, '-')
    // Same as the prerender's canonical slug: "… kit chaîne ?" must not end
    // in "-", or every internal link 301s to the canonical URL.
    .replace(/^-+|-+$/g, '');
};
