import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBrandPageState, DEFAULT_BRAND_PAGE_STATE } from './techSpecPageState';

const page = readFileSync(new URL('../components/TechSpecsModels.tsx', import.meta.url), 'utf8');

test('a saved brand page state comes back as it was', () => {
  const s = { sort: 'price-asc', type: 'Scooter', year: '2025', cc: '51 à 125 cc', q: 'jet' };
  assert.deepEqual(parseBrandPageState(JSON.stringify(s)), s);
});

test('odd or broken saved values fall back to the defaults', () => {
  assert.equal(parseBrandPageState(null), null);
  assert.equal(parseBrandPageState('{oops'), null);
  assert.deepEqual(parseBrandPageState(JSON.stringify({ sort: 'cheapest', year: 2025, q: 'x'.repeat(500) })), DEFAULT_BRAND_PAGE_STATE);
});

test('the brand page gives the state back on Back only, and no longer forces the top', () => {
  assert.match(page, /navigationType === 'POP' && readBrandPageState\(brandSlug\)\) \|\| DEFAULT_BRAND_PAGE_STATE/);
  assert.match(page, /saveBrandPageState\(brandSlug, \{ sort, type: activeType, year: activeYear, cc: activeCC, q: modelSearch \}\)/);
  // The router restores the position on Back; this page used to reset it.
  assert.doesNotMatch(page, /window\.scrollTo\(0, 0\)/);
});
