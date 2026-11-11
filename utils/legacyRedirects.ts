/**
 * Old addresses Google still knows (Search Console, 2026-11-11) that used to
 * answer 404 or compete with the clean URL. Pure helpers for
 * api/og-prerender.ts.
 */

/** Sheets that were renamed (or deleted and recreated): old slug → current slug. */
export const RENAMED_FICHES: Record<string, string> = {
  // 574 impressions over 90 days on the old address, still indexed, 404.
  'honda-x-adv': 'honda-x-adv-750',
};

const UUID = /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Slugs to try, in order, when /fiche-technique/<tail> finds no sheet:
 * a renamed sheet, then the legacy « <slug>-<année>-<uuid> » form whose record
 * no longer exists (its short slug, and that slug's new name).
 */
export function ficheSlugCandidates(tail: string): string[] {
  const clean = tail.replace(/\/$/, '').toLowerCase();
  const out: string[] = [];
  const add = (s?: string) => { if (s && s !== clean && !out.includes(s)) out.push(s); };
  add(RENAMED_FICHES[clean]);
  if (UUID.test(clean)) {
    const base = clean.replace(UUID, '').replace(/-(19|20)\d{2}$/, '');
    add(RENAMED_FICHES[base]);
    add(base);
  }
  return out;
}

/**
 * /fiches-techniques/<marque>?available_in_tunisia=true shows the crawler the
 * same page as the clean URL; Google indexed the parameter version instead of
 * the declared canonical (172 clicks on QJ Motor). True when the request
 * carries that parameter, so the handler answers 301 to the clean URL. In the
 * app the filter still works: links are followed without a server round trip.
 */
export function hasTunisiaParam(query: Record<string, unknown> | undefined, url?: string): boolean {
  const q = query || {};
  if (q.available_in_tunisia !== undefined || q.availableInTunisia !== undefined) return true;
  return /[?&](available_in_tunisia|availableInTunisia)=/.test(url || '');
}
