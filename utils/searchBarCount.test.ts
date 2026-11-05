import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filtersFromSearch, filtersToServerParams } from '../hooks/useListingFilters.ts';

test('the home card counts with the exact filters the results page applies', () => {
  const params = filtersToServerParams(filtersFromSearch({ brand: 'SYM', maxPrice: 10000, minYear: 2019, location: 'Tunis' } as any), ['recent'], null, 1, 1);
  assert.equal(params.brand, 'SYM');
  assert.equal(params.max_price, 10000);
  assert.equal(params.min_year, 2019);
  assert.equal(params.governorate, 'Tunis');
  // No filter: no narrowing parameter at all.
  const none = filtersToServerParams(filtersFromSearch({}), ['recent'], null, 1, 1);
  assert.deepEqual(Object.keys(none).sort(), ['limit', 'page', 'sort']);
});

test('the button no longer shows the site-wide total, and shows nothing for « Autour de moi »', () => {
  const src = readFileSync(new URL('../components/search/SearchBar.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /useListingsCount/);
  assert.match(src, /searchFilters\.aroundMe \? null : filtersToServerParams\(filtersFromSearch\(/);
  assert.match(src, /const \{ data: matchCount \} = useListingsTotal\(countParams\);/);
  // The results page builds its first state with the same helper.
  assert.match(readFileSync(new URL('../hooks/useListingFilters.ts', import.meta.url), 'utf8'), /useState<FilterState>\(\(\) => filtersFromSearch\(initialFilters\)\)/);
});
