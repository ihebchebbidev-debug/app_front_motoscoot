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

/** The link blocks of one entry page. A page never links to itself. */
export function linkBlocksFor(path: string, data: { brands?: string[] } = {}): SnapshotLinkBlock[] {
  const blocks: SnapshotLinkBlock[] = [
    { heading: 'Rubriques', links: SECTION_LINKS.filter((l) => l.href !== path) },
  ];
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
