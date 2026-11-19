import { slugify } from './slugify.js';

/**
 * Links from a listing to the catalogue (SEO audit of 2026-11-19, H3): the
 * listing page linked to nothing but itself, so Google could not go from a
 * listing to the fiche of its model or to its brand. Shared by the React
 * page (components/listing/ListingCatalogLinks.tsx) and the HTML Google
 * receives (api/og-listing.ts), so both show the same links.
 *
 * A fiche is linked only when it is clearly the same model: never a
 * neighbour (« TMAX 530 Iron » is not the « TMAX 560 »).
 */

export interface CatalogSpec { brand?: string | null; model?: string | null; slug?: string | null; id?: string | number | null }
export interface ListingCatalogLink { href: string; label: string; kind: 'fiche' | 'marque' }

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Same model: equal names (« JET X 125 » = « Jet X 125 »), or the fiche name
 * continues the listing's (« DINK-R » → « DINK-R 125 Tunnel », the shortest
 * such fiche). Listing names under 3 characters match nothing.
 */
export function matchListingFiche<T extends CatalogSpec>(model: string | null | undefined, specs: T[]): T | null {
  const m = norm(model);
  if (m.length < 3) return null;
  const withSlug = specs.filter((s) => s.slug);
  const exact = withSlug.find((s) => norm(s.model) === m);
  if (exact) return exact;
  const longer = withSlug.filter((s) => norm(s.model).startsWith(m)).sort((a, b) => norm(a.model).length - norm(b.model).length);
  return longer[0] ?? null;
}

/** The brand as the catalogue writes it (« sym » → « SYM »), or null when it has no page. */
export const catalogBrand = (brand: string | null | undefined, catalogBrands: string[]) =>
  catalogBrands.find((b) => norm(b) === norm(brand) && norm(b)) ?? null;

/** Fiche of the model (when there is one), then every fiche of the brand. */
export function listingCatalogLinks(
  listing: { brand?: string | null; model?: string | null },
  catalogBrands: string[],
  brandSpecs: CatalogSpec[],
): ListingCatalogLink[] {
  const brand = catalogBrand(listing.brand, catalogBrands);
  if (!brand) return [];
  const links: ListingCatalogLink[] = [];
  const fiche = matchListingFiche(listing.model, brandSpecs);
  if (fiche) links.push({ kind: 'fiche', href: `/fiche-technique/${fiche.slug}`, label: `Fiche technique ${[brand, fiche.model].filter(Boolean).join(' ')}` });
  links.push({ kind: 'marque', href: `/fiches-techniques/${slugify(brand)}`, label: `Toutes les fiches ${brand}` });
  return links;
}

export const LISTING_CATALOG_HEADING = 'Fiche technique et prix du neuf';
