import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../components/TechSpecsBrands.tsx', import.meta.url), 'utf8');
const bar = readFileSync(new URL('../components/ui/FilterBar.tsx', import.meta.url), 'utf8');

test('brand tiles answer the finger at once; hover effects only for mice', () => {
  assert.match(page, /active:scale-\[0\.97\] active:bg-gray-200\/60/);
  assert.match(page, /duration-100 ease-out/);
  assert.match(page, /\[@media\(hover:hover\)\]:group-hover:scale-105/);
  assert.doesNotMatch(page, /[" ]group-hover:scale-105/);
});

test('phones: a search-only page shows the search field, not a « Filtres » button', () => {
  assert.match(bar, /const onlySearch = categories\.length === 0 && extraFilters\.length === 0 && toggles\.length === 0 && !hasSort;/); // a switch is a filter too
  assert.match(bar, /\{\(onlySearch \|\| phoneSearch\) && \(\s*<div className="relative" role="search">/);
  assert.match(bar, /\{!onlySearch && \(\s*<div className="flex gap-2">/); // no Filtres button then
  assert.match(bar, /type="search"\s+enterKeyHint="search"/);
  // Its full name for screen readers (« Rechercher une marque ou un modèle »).
  assert.match(bar, /aria-label=\{searchLabel \|\| searchPlaceholder\}\s+placeholder=\{searchPlaceholder\}\s+value=\{searchQuery\}\s+onChange=\{\(e\) => onSearchChange\(e\.target\.value\)\}\s+className="w-full h-12/);
  assert.match(bar, /text-\[16px\]/); // no iOS zoom on focus
  assert.match(bar, /aria-label="Effacer la recherche"\s+className="absolute right-1 top-1\/2 -translate-y-1\/2 w-11 h-11/);
});

test('no brand found: say it and offer to clear the search', () => {
  assert.match(page, /Aucune marque pour « \{brandSearch\} »/);
  assert.match(page, /onClick=\{\(\) => setBrandSearch\(''\)\}/);
  assert.match(page, />\s*Effacer la recherche\s*</);
});

test('type scale: sentence-case titles, readable counts and names, no 9-11 px text', () => {
  assert.equal((page.match(/text-xl md:text-2xl font-bold text-gray-900 tracking-\[-0\.01em\] leading-tight/g) || []).length, 3);
  assert.doesNotMatch(page, /font-\[900\] text-slate-900 uppercase/);
  assert.match(page, />\s*Marques populaires\s*</);
  assert.match(page, /\{filteredBrands\.length\} marque\{filteredBrands\.length > 1 \? 's' : ''\}/);
  assert.equal((page.match(/shrink-0 text-sm font-medium text-gray-600 tabular-nums/g) || []).length, 2);
  assert.match(page, /BrandName: "text-sm font-semibold text-gray-900 /);
  assert.doesNotMatch(page, /text-\[9px\]|text-\[11px\] text-slate-500|text-slate-400 italic/);
  assert.match(page, /text-\[0\.9375rem\] leading-5 font-semibold/); // model name 15 px, rem
});

test('phones: popular brands in 3 columns × 2 rows (6 brands, smaller logos under 640 px)', () => {
  assert.match(page, /PopularGrid: "grid grid-cols-2 min-\[360px\]:grid-cols-3 gap-x-2 gap-y-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"/);
  // Every brand in 3 columns too (2 under 360 px), with the compact tile.
  assert.match(page, /Grid: "grid grid-cols-2 min-\[360px\]:grid-cols-3 gap-x-2 gap-y-3 sm:gap-6 md:grid-cols-4/);
  assert.match(page, /logoMap=\{logoMap\}\s+compact\s+\/>\s+<\/Reveal>\s+\)\)\}\s+<\/div>/);
  assert.match(page, /<div className=\{`\$\{S\.PopularGrid\} md:mb-16`\}>/);
  assert.match(page, /<div className="mb-12 md:mb-24">/); // tighter on phones
  assert.match(page, /LogoCompact: "w-24 h-24 max-w-full sm:w-\[115px\] sm:h-\[115px\]"/); // 96 px logo boxes on phones
  assert.match(page, /CardCompact: "min-h-\[132px\] sm:min-h-\[155px\] justify-start pt-1 gap-2 sm:gap-3"/); // 132 px at least; a 2-line name adds a line
  assert.match(page, /BrandName: "text-sm font-semibold text-gray-900 /); // name unchanged
  assert.match(page, /const limit = 6;/);
});

test('model search results are real links that answer the finger within 100 ms', () => {
  assert.match(page, /<Link\s+key=\{spec\.id\}\s+to=\{specHref\(spec\)\}/);
  assert.doesNotMatch(page, /onClick=\{\(\) => handleSpecClick\(spec\)\}/);
  assert.match(page, /duration-100 ease-out active:scale-\[0\.97\] active:bg-gray-50/);
  assert.doesNotMatch(page, /delay=\{\(idx % 8\) \* 30\}/); // no slide-in on results
});

test('phones under 360 px: the chosen sort keeps its room (it read « A… » next to « Filtres 2 »)', () => {
  assert.match(bar, /<span className="truncate">\{sortButtonLabel\}<\/span>/);
  assert.match(bar, /const sortButtonLabel = chosenSort\?\.short \?\? sortLabel;/);
  assert.match(bar, /ChevronDown size=\{16\} className="hidden min-\[360px\]:block text-gray-400 shrink-0"/);
  assert.match(bar, /h-12 px-4 min-\[360px\]:px-6 bg-gray-900/);
});

test('one phone row: the sort button says the chosen sort from 360 px, the icon alone below', () => {
  assert.match(bar, /\$\{inlineSortLabel \? 'w-11 min-\[360px\]:w-auto min-\[360px\]:px-3' : 'w-11'\}/);
  assert.match(bar, /<span className="hidden min-\[360px\]:inline text-\[15px\] font-semibold whitespace-nowrap" aria-hidden="true">\{sortButtonLabel\}<\/span>/);
});

test('brand tiles: a long name (« BMW Motorrad ») shows whole on 2 lines, logos of a row stay aligned', () => {
  assert.match(page, /text-center w-full line-clamp-2 leading-5 break-words px-2/);
  assert.match(page, /CardCompact: "min-h-\[132px\] sm:min-h-\[155px\] justify-start pt-1 gap-2 sm:gap-3"/);
  assert.match(page, /\.replace\('justify-center', ''\) \+ ' ' \+ S\.CardCompact/);
});
