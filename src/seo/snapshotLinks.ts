import { slugify } from '../../utils/slugify';

/**
 * Real links for the build-time HTML of the entry pages (SEO audit of
 * 2026-11-11, priority 1). Their raw HTML held one link, « Retour à
 * l'accueil »: every link of the home page, /annonces, /fiches-techniques…
 * existed only after JavaScript, and Search Console showed the sitemap as
 * the only origin Google knew for listings, articles and sheets.
 *
 * Every link here is also a link of the page React renders (menu, footer,
 * brand tiles): same destinations, nothing shown to crawlers only.
 *
 * Pure functions; vitePluginSeoSnapshots.ts supplies the data it reads from
 * the API at build time.
 */
export interface SnapshotLink { href: string; label: string }
export interface SnapshotLinkBlock { heading: string; links: SnapshotLink[] }

/** The sections of the site: the header menu and its sub-menus. */
export const SECTION_LINKS: SnapshotLink[] = [
  { href: '/annonces', label: "Annonces de motos et scooters d'occasion" },
  { href: '/fiches-techniques', label: 'Fiches techniques et prix du neuf' },
  { href: '/prix/scooter-125-tunisie', label: 'Prix des scooters 125 neufs en Tunisie' },
  { href: '/comparateur', label: 'Comparateur de motos et scooters' },
  { href: '/actualites', label: 'Actualités moto et scooter' },
  { href: '/conseils', label: "Conseils et guides d'entretien" },
];

/** Pages whose own content is the list of brands (the home page shows them too). */
const BRAND_PAGES = new Set(['/', '/fiches-techniques', '/comparateur']);

/** « /fiches-techniques/qj-motor », labelled like the brand page's title. */
export function brandLinks(brands: string[]): SnapshotLink[] {
  const seen = new Set<string>();
  const out: SnapshotLink[] = [];
  for (const b of brands) {
    const name = (b || '').trim();
    const slug = slugify(name);
    if (!name || name === 'Autre' || !/^[a-z0-9-]+$/.test(slug) || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ href: `/fiches-techniques/${slug}`, label: `${name} : prix et fiches techniques` });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

export interface SnapshotListing {
  title?: string | null;
  listing_number?: string | number | null;
  id?: string | number | null;
  price?: number | string | null;
  status?: string | null;
}

/** At most this many listings in the HTML (newest first, as the API sends them). */
export const MAX_LISTING_LINKS = 100;

const NBSP = String.fromCharCode(0xa0);
const dt = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? `${Math.round(n).toLocaleString('fr-FR').replace(/\s/g, NBSP)}${NBSP}DT` : '';
};

/**
 * « /annonce/yamaha-tmax-530-iron-2012-24 »: the same address as the listing
 * cards, the sitemap and the listing page's canonical (slug of the title +
 * listing number), so no link goes through a redirect.
 */
export function listingLinks(listings: SnapshotListing[]): SnapshotLink[] {
  const out: SnapshotLink[] = [];
  const seen = new Set<string>();
  for (const l of listings) {
    if (!l || (l.status && l.status !== 'active')) continue;
    const title = String(l.title || '').replace(/\s+/g, ' ').trim();
    const ref = l.listing_number ?? l.id;
    if (!title || ref === null || ref === undefined || ref === '') continue;
    const href = `/annonce/${slugify(title)}-${ref}`;
    if (seen.has(href)) continue;
    seen.add(href);
    const price = dt(l.price);
    out.push({ href, label: price ? `${title} – ${price}` : title });
    if (out.length >= MAX_LISTING_LINKS) break;
  }
  return out;
}

/** The link blocks of one entry page. A page never links to itself. */
export function linkBlocksFor(path: string, data: { brands?: string[]; listings?: SnapshotListing[] } = {}): SnapshotLinkBlock[] {
  const blocks: SnapshotLinkBlock[] = [
    { heading: 'Rubriques', links: SECTION_LINKS.filter((l) => l.href !== path) },
  ];
  // /annonces: the listings themselves, first (step 2). Before this, Google
  // only knew them from the sitemap.
  const listings = path === '/annonces' ? listingLinks(data.listings || []) : [];
  if (listings.length) blocks.unshift({ heading: 'Annonces en ligne', links: listings });
  const brands = BRAND_PAGES.has(path) ? brandLinks(data.brands || []) : [];
  if (brands.length) blocks.push({ heading: 'Marques', links: brands });
  return blocks;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function renderLinkBlocks(blocks: SnapshotLinkBlock[]): string {
  return blocks
    .filter((b) => b.links.length)
    .map((b) => `<nav aria-label="${esc(b.heading)}"><h2>${esc(b.heading)}</h2><ul>${b.links
      .map((l) => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`)
      .join('')}</ul></nav>`)
    .join('\n      ');
}
