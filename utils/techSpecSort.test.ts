import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { priceValue, ccValue, powerValue, sortTechSpecs, TECH_SPEC_SORTS } from './techSpecSort';

// Real SYM values from the API (6 Nov 2026).
const sym = [
  ['Jet 14 EVO 125', '9 000 DT', '124.7 cc', '12.6 ch', 2026],
  ['ADX 300', '24 000 DT', '278 cc', '26 ch', 2025],
  ['ADXTG 400', 'En arrivage', '399 cc', '35 ch', 2025],
  ['Fiddle 4 injection', '6 999 DT', '124.6 CC', '11.7 ch', 2025],
  ['Husky ADV 200', '16 000 DT', '175 cc', '18 ch', 2025],
  ['Jet 4 RX 125', '6 199 DT', '124.6 cc', '11.4 ch à 8500 tr/min', 2025],
  ['Jet X 125', '9 399 DT', '125 cc', '9.3 kW (12.6 ch) à 8000 tr/min', 2025],
  ['Fiddle II Carburateur', '5 850 DT', '124.6 cc', '8 ch', 2020],
  ['Symphony SR 125 CBS', '6 580 DT', '124.6 cm³', '6.5 kW', 2020],
].map(([model, priceNew, cc, power, year], i) => ({ id: i, brand: 'SYM', model, priceNew, year, engine: { cc, power } }) as any);
const names = (list: any[]) => list.map((m) => m.model);

test('prices, cylinders and powers are read from the free-text fields', () => {
  assert.equal(priceValue('9 000 DT'), 9000); // narrow no-break space (fr-FR)
  assert.equal(priceValue('24 000 DT'), 24000);
  assert.equal(priceValue('À partir de 35 000 DT'), 35000);
  assert.equal(priceValue('10900'), 10900);
  assert.equal(priceValue('En arrivage'), null);
  assert.equal(priceValue('—'), null);
  assert.equal(ccValue('124.6 CC'), 124.6);
  assert.equal(ccValue('399 cm³'), 399);
  assert.equal(powerValue('9.3 kW (12.6 ch) à 8000 tr/min'), 12.6);
  assert.equal(powerValue('11.4 ch à 8500 tr/min'), 11.4);
  assert.equal(powerValue('6.5 kW'), 8.8);
  assert.equal(powerValue(''), null);
});

test('price ascending: cheapest first, « En arrivage » last', () => {
  const list = names(sortTechSpecs(sym, 'price-asc'));
  assert.deepEqual(list.slice(0, 3), ['Fiddle II Carburateur', 'Jet 4 RX 125', 'Symphony SR 125 CBS']);
  assert.equal(list.at(-1), 'ADXTG 400');
});

test('price descending: dearest first, « En arrivage » still last', () => {
  const list = names(sortTechSpecs(sym, 'price-desc'));
  assert.deepEqual(list.slice(0, 2), ['ADX 300', 'Husky ADV 200']);
  assert.equal(list.at(-1), 'ADXTG 400');
});

test('cylinder ascending and most powerful first', () => {
  assert.deepEqual(names(sortTechSpecs(sym, 'cc-asc')).slice(-3), ['Husky ADV 200', 'ADX 300', 'ADXTG 400']);
  assert.deepEqual(names(sortTechSpecs(sym, 'power-desc')).slice(0, 3), ['ADXTG 400', 'ADX 300', 'Husky ADV 200']);
});

test('« Plus récentes »: newest year first, catalogue order kept within a year', () => {
  const list = names(sortTechSpecs(sym, 'recent'));
  assert.equal(list[0], 'Jet 14 EVO 125');
  assert.deepEqual(list.slice(-2), ['Fiddle II Carburateur', 'Symphony SR 125 CBS']);
  assert.deepEqual(TECH_SPEC_SORTS.map((s) => s.label), ['Plus récentes', 'Prix croissant', 'Prix décroissant', 'Cylindrée croissante', 'Plus puissantes']);
});

test('the phone sort button exists only when something can be sorted', () => {
  const bar = readFileSync(new URL('../components/ui/FilterBar.tsx', import.meta.url), 'utf8');
  assert.match(bar, /const hasSort = hasCustomSort \|\| \(showSort && !!onSortChange\);/);
  assert.match(bar, /\{hasSort && \(\s*<button/);
  const page = readFileSync(new URL('../components/TechSpecsModels.tsx', import.meta.url), 'utf8');
  assert.match(page, /sortOptions=\{TECH_SPEC_SORTS\}/);
  assert.match(page, /sortTechSpecs\(filteredModels, sort\)/);
  assert.doesNotMatch(page, /import \{\s*\} from 'react-router-dom'/);
});

test('tablet and desktop: the sort sits in the filter bar, the search is shorter, nothing runs off the screen', () => {
  const bar = readFileSync(new URL('../components/ui/FilterBar.tsx', import.meta.url), 'utf8');
  assert.match(bar, /<select\s+aria-label="Trier par"\s+value=\{sortValue\}/);
  // ≥ 1280 px one line, search capped at 360 px; below, line 2 = search + sort.
  assert.match(bar, /flex-1 min-w-0 xl:max-w-\[360px\] xl:ml-auto order-11 xl:order-none/);
  assert.match(bar, /basis-full h-0 order-10 xl:hidden/);
  assert.match(bar, /flex-wrap xl:flex-nowrap/);
  const page = readFileSync(new URL('../components/TechSpecsModels.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /Trier par/); // no second sort above the cards
});
