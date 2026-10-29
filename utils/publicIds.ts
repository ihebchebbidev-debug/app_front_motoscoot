/**
 * Short public identifiers used in URLs.
 *
 * Listings keep their UUID internally but are linked as /annonce/<slug>-<number>.
 * Technical sheets are linked as /fiche-technique/<slug>.
 * The API mappers register each record here, so any code that builds a URL
 * from an internal id (getUrlFromState) gets the short form automatically.
 */
const listingNumbers = new Map<string, number>();
const specSlugs = new Map<string, string>();

export function registerListingNumber(id: unknown, number: unknown) {
  const n = Number(number);
  if (id != null && Number.isInteger(n) && n > 0) listingNumbers.set(String(id), n);
}

export function registerSpecSlug(id: unknown, slug: unknown) {
  if (id != null && typeof slug === 'string' && /^[a-z0-9-]+$/.test(slug)) specSlugs.set(String(id), slug);
}

export function getListingNumber(id: unknown): number | undefined {
  return id == null ? undefined : listingNumbers.get(String(id));
}

export function getSpecSlug(id: unknown): string | undefined {
  return id == null ? undefined : specSlugs.get(String(id));
}
