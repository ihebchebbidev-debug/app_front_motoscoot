/**
 * Shared links carry utm_* tags only where they travel as plain text
 * (WhatsApp, Messenger, the phone's share sheet): a click there sends no
 * referrer, so services/trackingService.ts would count the visit as direct.
 * Facebook and LinkedIn are left alone — they link to og:url (the clean
 * canonical) and their referrer already identifies the visit.
 * The canonical URL drops utm_* again (components/common/SEO.tsx), so Google
 * still sees a single page.
 */
export const NATIVE_SHARE_SOURCE = 'partage-mobile';

const TAGGED_SOURCES = new Set(['whatsapp', 'messenger', NATIVE_SHARE_SOURCE]);

const CAMPAIGN_BY_KIND = {
  listing: 'partage-annonce',
  article: 'partage-article',
  tip: 'partage-guide',
  techspec: 'partage-fiche-technique',
} as const;

export function shareLink(url: string, source: string, kind: keyof typeof CAMPAIGN_BY_KIND): string {
  if (!TAGGED_SOURCES.has(source)) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', source);
    u.searchParams.set('utm_medium', 'social');
    u.searchParams.set('utm_campaign', CAMPAIGN_BY_KIND[kind]);
    return u.toString();
  } catch {
    return url;
  }
}
