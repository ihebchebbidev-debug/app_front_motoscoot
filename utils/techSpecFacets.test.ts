import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALL, typeOf, ccBandOf, facetOptions, matchesFacets, activeFacetCount, MIN_MODELS_FOR_FILTERS } from './techSpecFacets';

// Real SYM models (6 Nov 2026): all scooters, 124.6 to 399 cc.
const sym = [
  ['Jet 14 EVO 125', '124.7 cc', 2026], ['ADX 300', '278 cc', 2025], ['ADXTG 400', '399 cc', 2025],
  ['Fiddle 4 injection', '124.6 CC', 2025], ['Husky ADV 200', '175 cc', 2025], ['Jet 4 RX 125', '124.6 cc', 2025],
  ['Jet X 125', '125 cc', 2025], ['Fiddle II Carburateur', '124.6 cc', 2020], ['Symphony SR 125 CBS', '124.6 cm³', 2020],
].map(([model, cc, year], i) => ({ id: i, brand: 'SYM', model, year, category: 'Scooter', engine: { cc } }) as any);
const none = { type: ALL, year: ALL, cc: ALL };

test('SYM: only the types and bands it really has, with their counts', () => {
  assert.deepEqual(facetOptions(sym, none, 'type'), [{ value: 'Scooter', count: 9 }]);
  assert.deepEqual(facetOptions(sym, none, 'cc'), [{ value: '51 à 125 cc', count: 6 }, { value: '126 à 500 cc', count: 3 }]);
  assert.deepEqual(facetOptions(sym, none, 'year'), [{ value: '2026', count: 1 }, { value: '2025', count: 6 }, { value: '2020', count: 2 }]);
});

test('counts follow the other filters (never a surprise « Aucun modèle »)', () => {
  const y2020 = { ...none, year: '2020' };
  assert.deepEqual(facetOptions(sym, y2020, 'cc'), [{ value: '51 à 125 cc', count: 2 }, { value: '126 à 500 cc', count: 0 }]);
  // The year list ignores its own choice, so the visitor can switch year directly.
  assert.equal(facetOptions(sym, y2020, 'year').length, 3);
  assert.equal(sym.filter((m) => matchesFacets(m, { ...none, cc: '126 à 500 cc' })).length, 3);
});

test('types and cylinder bands on the licence thresholds', () => {
  assert.equal(typeOf({ category: 'Scooter', engine: { cc: '399 cc' } } as any), 'Scooter');
  assert.equal(typeOf({ category: 'Scooter', engine: { cc: '530 cc' } } as any), 'Maxi-scooter');
  assert.equal(typeOf({ category: 'Off-road', engine: { cc: '250 cc' } } as any), 'Tout-terrain');
  assert.equal(ccBandOf({ engine: { cc: '49.5 cc' } } as any), '50 cc et moins');
  assert.equal(ccBandOf({ engine: { cc: '125 cc' } } as any), '51 à 125 cc');
  assert.equal(ccBandOf({ engine: { cc: '689 cc' } } as any), 'Plus de 500 cc');
  assert.equal(ccBandOf({ engine: { cc: '' } } as any), null);
  assert.equal(activeFacetCount({ type: ALL, year: '2025', cc: '51 à 125 cc' }), 2);
  assert.equal(MIN_MODELS_FOR_FILTERS, 5);
});

test('the brand page uses them: counts, reset, « Voir N modèles », no filters under 5 models', () => {
  const page = readFileSync(new URL('../components/TechSpecsModels.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /'Naked \/ Roadster'|'Off-Road \/ Enduro'|'560-1300'/);
  assert.match(page, /categoryCounts=\{toCounts\(typeOptions\)\}/);
  assert.match(page, /applyLabel=\{`Voir \$\{filteredModels\.length\} modèle/);
  assert.match(page, /action=\{activeCount > 0 \? \{ label: 'Réinitialiser les filtres', onClick: resetFilters \}/);
  assert.match(page, /\{showFilters && \(\s*<FilterBar/);
  const bar = readFileSync(new URL('../components/ui/FilterBar.tsx', import.meta.url), 'utf8');
  assert.match(bar, /min-h-11 px-4 py-2\.5 rounded-xl/); // 44 px chips
  assert.match(bar, /disabled=\{empty\}/);
  assert.match(bar, /aria-label=\{filter\.label\}/);
});

test('a filter with a single choice is not shown (SYM: « Scooter » only)', () => {
  const page = readFileSync(new URL('../components/TechSpecsModels.tsx', import.meta.url), 'utf8');
  assert.match(page, /\.filter\(\(f\) => f\.options\.length > 2 \|\| f\.value !== ALL\)/);
  assert.match(page, /const showTypes = typeOptions\.length > 1 \|\| activeType !== ALL;/);
  assert.match(page, /categoriesVariant=\{showTypes \? 'dropdown' : 'list'\}/);
});

test('model cards: the comparator grey behind the bike (5 % black veil over the photo)', () => {
  const card = readFileSync(new URL('../components/tech-specs/TechSpecModelCard.tsx', import.meta.url), 'utf8');
  assert.match(card, /<div className="absolute inset-0 bg-black\/5 pointer-events-none" aria-hidden="true" \/>/);
  assert.match(readFileSync(new URL('../components/home/ModelCard.tsx', import.meta.url), 'utf8'), /absolute inset-0 bg-black\/5/);
});

test('no grey band between the orange header and the white cards (brand page, brands list)', () => {
  for (const p of ['../components/TechSpecsModels.tsx', '../components/TechSpecsBrands.tsx']) {
    const src = readFileSync(new URL(p, import.meta.url), 'utf8');
    assert.match(src, /Wrapper: "min-h-screen bg-\[#F8F9F9\] md:bg-card font-sans"/, p);
  }
});
