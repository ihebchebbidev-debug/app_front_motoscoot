import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const comp = read('components/ui/PageBreadcrumb.tsx');

const PAGES = [
  'components/SearchResults.tsx', 'components/Garages.tsx', 'components/ListingDetails.tsx',
  'components/ArticleDetails.tsx', 'components/TipDetails.tsx', 'components/GarageDetails.tsx',
  'components/FAQ.tsx', 'components/Legal.tsx', 'components/Security.tsx', 'components/Terms.tsx',
  'components/Cookies.tsx', 'components/Sitemap.tsx', 'components/Favorites.tsx',
  'components/TechSpecsDetails.tsx', 'components/tech-specs/TechSpecsHero.tsx',
];

test('one breadcrumb for the whole site: no page keeps its own copy', () => {
  for (const p of PAGES) {
    const src = read(p);
    assert.match(src, /<PageBreadcrumb\b/, p);
    // The old hand-made trail: 11/12 px grey-400 nav with a Home icon.
    assert.doesNotMatch(src, /text-\[11px\] md:text-\[13px\] font-medium text-gray-400/, p);
    assert.doesNotMatch(src, /<Home size=\{1[24]\}/, p);
  }
});

test('phones: a single « ← Parent » link, 44 px tall, readable', () => {
  assert.match(comp, /className="md:hidden inline-flex items-center gap-1\.5 min-h-11 [^"]*text-\[14px\] font-semibold text-gray-700/);
  assert.match(comp, /aria-label=\{`Retour à \$\{parent\.label\}`\}/);
});

test('from 768 px: real links in an ordered list, readable grey, current page announced', () => {
  assert.match(comp, /<nav aria-label="Fil d'Ariane"/);
  assert.match(comp, /<ol className=\{`flex items-center gap-2 min-w-0 text-\[13px\][^`]*text-gray-600/);
  assert.match(comp, /<li aria-current="page"/);
  assert.match(comp, /<a\s+href=\{crumb\.href\}/);
  // Cmd/Ctrl/middle click open the real URL; a plain click stays in the app.
  assert.match(comp, /if \(e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey \|\| e\.altKey \|\| e\.button !== 0\) return;/);
});

test('the trail names real pages', () => {
  // Listing: the listing itself (not its brand); back restores the search.
  const listing = read('components/ListingDetails.tsx');
  assert.match(listing, /current=\{isLoading \? '…' : listing\?\.title/);
  assert.match(listing, /back=\{\{ label: 'Annonces', href: '\/annonces', onClick: goBack \}\}/);
  // Model page: … › SYM › model.
  assert.match(read('components/TechSpecsDetails.tsx'), /label: 'Fiches techniques'[\s\S]*label: spec\.brand[\s\S]*current=\{`\$\{spec\.model\}/);
  // Brand and Scooter 125 pages: « Fiches techniques » step present.
  for (const p of ['components/TechSpecsModels.tsx', 'components/Scooter125Prices.tsx'])
    assert.match(read(p), /breadcrumbParents=\{\[\{ label: 'Fiches techniques', href: '\/fiches-techniques'/, p);
  // No « Mag' », no dead « Tunisie » step.
  assert.match(read('components/ArticleDetails.tsx'), /label: 'Actualités', href: '\/actualites'/);
  assert.doesNotMatch(read('components/GarageDetails.tsx'), />Tunisie</);
});

test('the hero pages show their title on phones (the trail no longer does it)', () => {
  assert.match(read('components/tech-specs/TechSpecsHero.tsx'), /titleOnMobile = true,/);
});
