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
