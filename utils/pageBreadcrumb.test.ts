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

test('every screen: back button + full trail (owner: « comme sur le desktop »)', () => {
  // One markup for all widths: no phone-only « ← Parent » link any more.
  assert.doesNotMatch(comp, /md:hidden flex w-fit/);
  assert.match(comp, /aria-label=\{`Retour à \$\{parent\.label\}`\}/);
  // Button: 44 px on phones, 40 px from 768 px.
  assert.match(comp, /w-11 h-11 md:w-10 md:h-10 rounded-xl border/);
  // Links 44 px tall to the finger without moving the layout.
  assert.match(comp, /className=\{`py-3 rounded transition-colors/);
  // Long trails on phones: middle steps fold into « … » under 640 px.
  assert.match(comp, /<li aria-hidden="true" className="sm:hidden shrink-0">…<\/li>/);
  assert.match(comp, /middle \? 'hidden sm:block' : ''/);
  // The orange header look starts at 768 px; phones keep the light one.
  assert.match(comp, /md:bg-white\/10 md:border-white\/25 md:text-white/);
});

test('real links in an ordered list, readable grey, current page announced', () => {
  assert.match(comp, /<nav aria-label="Fil d'Ariane"/);
  assert.match(comp, /<ol className=\{`flex items-center gap-1\.5 md:gap-2 min-w-0 text-\[13px\][^`]*text-gray-600/);
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

// Spacing (phones): the pages set 24 px under the header and 12 px between the
// breadcrumb row (button 44 px) and what follows.
test('phones: 24 px under the header and 12 px to the title, on every page', () => {
  assert.match(read('components/tech-specs/TechSpecsHero.tsx'), /className="mb-1 md:mb-3 w-full"/); // + gap-2 = 12
  for (const p of ['components/SearchResults.tsx', 'components/Garages.tsx']) {
    const src = read(p);
    assert.match(src, /Header: "flex flex-col md:flex-row md:items-end justify-between pt-0 pb-10 md:pt-6/, p);
    assert.match(src, /<PageBreadcrumb className="md:hidden mb-3"/, p);
  }
  assert.match(read('components/ListingDetails.tsx'), /Header: "flex items-center justify-between mb-3 md:mb-6"/);
  // Fiche: no breadcrumb row on phones (owner, 2026-11-11); « ← » on the photo instead.
  assert.match(read('components/TechSpecsDetails.tsx'), /Header: "hidden md:flex items-center justify-between mb-3 md:mb-6"/);
  for (const p of ['components/ArticleDetails.tsx', 'components/TipDetails.tsx']) {
    const src = read(p);
    assert.match(src, /<div className="pt-0 md:pt-8">/, p);
    assert.match(src, /className="mb-3 md:mb-8"/, p);
  }
  assert.match(read('components/GarageDetails.tsx'), /pt-0 md:pt-6">[\s\S]*?<header className="flex items-center justify-between mb-3 md:mb-6">/);
});
