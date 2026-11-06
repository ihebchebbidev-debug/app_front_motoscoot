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
  assert.match(bar, /const onlySearch = categories\.length === 0 && extraFilters\.length === 0 && !hasSort;/);
  assert.match(bar, /\{onlySearch \? \(\s*<div className="relative" role="search">/);
  assert.match(bar, /type="search"\s+enterKeyHint="search"/);
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
  assert.match(page, /'Marques populaires'/);
  assert.match(page, /\{filteredBrands\.length\} marque\{filteredBrands\.length > 1 \? 's' : ''\}/);
  assert.equal((page.match(/shrink-0 text-sm font-medium text-gray-600 tabular-nums/g) || []).length, 2);
  assert.match(page, /BrandName: "text-sm font-semibold text-gray-900 /);
  assert.doesNotMatch(page, /text-\[9px\]|text-\[11px\] text-slate-500|text-slate-400 italic/);
  assert.match(page, /text-\[0\.9375rem\] leading-5 font-semibold/); // model name 15 px, rem
});
