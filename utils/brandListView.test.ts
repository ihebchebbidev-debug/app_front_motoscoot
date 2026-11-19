import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BRAND_VIEWS, brandGridTitle, orderBrands, uniqueBrands, importerOptions, importsBrand } from './brandListView';

const page = readFileSync(new URL('../components/TechSpecsBrands.tsx', import.meta.url), 'utf8');

test('the sorts of the brand list (« Disponibles en Tunisie » is a filter now)', () => {
  assert.deepEqual(BRAND_VIEWS.map((v) => v.label), ['Toutes les marques', 'Ordre alphabétique', 'Les plus consultées']);
  assert.equal(brandGridTitle('alpha'), 'Toutes les marques');
  // Phone button: short words, never cut at 375 px.
  assert.deepEqual(BRAND_VIEWS.map((v) => v.short), ['Toutes', 'A → Z', 'Plus vues']);
  assert.equal(brandGridTitle('popular'), 'Les plus consultées');
});

test('unique brands, A to Z, most visited first', () => {
  const brands = uniqueBrands(['SYM', 'Sym', 'Autre', 'Honda', 'CFMoto', 'Peugeot', 'Teyin']);
  assert.deepEqual(brands, ['SYM', 'Honda', 'CFMoto', 'Peugeot', 'Teyin']);
  assert.deepEqual(orderBrands(brands, 'all'), ['CFMoto', 'Honda', 'Peugeot', 'SYM', 'Teyin']);
  // /brands/popular order, repeated in other cases; unvisited brands last A → Z.
  assert.deepEqual(orderBrands(brands, 'popular', ['SYM', 'Peugeot', 'Teyin', 'teyin', 'sym']), ['SYM', 'Peugeot', 'Teyin', 'CFMoto', 'Honda']);
});

test('importers: only those bringing in a shown brand, with counts', () => {
  const importers = [
    { name: 'Megacycle', brands: ['SYM', 'Voge'] }, { name: 'UNISCOOT', brands: [] },
    { name: 'SIMCC', brands: ['KTM', 'Peugeot'] }, { name: 'JOURY MOTO', brands: ['Teyin'] },
  ];
  assert.deepEqual(importerOptions(importers, ['SYM', 'Peugeot', 'Voge', 'Honda']), [
    { value: 'Megacycle', count: 2 }, { value: 'SIMCC', count: 1 },
  ]);
  assert.equal(importsBrand(importers[0], 'sym'), true);
});

test('the brand list uses the shared bar: sort, importer filter, worded phone buttons', () => {
  assert.match(page, /sortOptions=\{BRAND_VIEWS\}/);
  assert.match(page, /extraFilters=\{extraFilters\}/);
  // Phones like /annonces: search on its own row, then « ⇅ tri » + « Filtres ».
  assert.match(page, /\n\s+phoneSearch\n/);
  assert.doesNotMatch(page, /phoneLayout="inline"/);
  assert.match(page, /const activeFilterCount = \(activeImporter !== ALL_IMPORTERS \? 1 : 0\) \+ \(inTunisia \? 1 : 0\);/);
  assert.doesNotMatch(page, /COUNTRIES|activeCountry/); // the hidden « Pays » filter is gone
  // The popular block only on arrival; « Toutes les marques » shows only the list.
  assert.match(page, /const showPopular = !brandSearch && view === 'default' && activeImporter === ALL_IMPORTERS && !inTunisia;/);
  assert.match(page, /useState<BrandView>\('default'\)/);
  assert.match(page, /sortPlaceholder="Trier"/);
});

test('from 768 px the brand list puts the sort next to the importer menu, the search on the right', () => {
  assert.match(page, /sortPlacement="withFilters"/);
  const bar = readFileSync(new URL('../components/ui/FilterBar.tsx', import.meta.url), 'utf8');
  assert.match(bar, /\{sortWithFilters && sortSelect\}/);
  assert.match(bar, /'relative group flex-1 min-w-0 max-w-\[360px\] ml-auto'/);
  assert.match(bar, /\{wrapBar && sortSelect\}/); // the brand page keeps its sort at the end
});
