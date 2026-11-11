import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BRAND_VIEWS, orderBrands, uniqueBrands, importerOptions, importsBrand } from './brandListView';

const page = readFileSync(new URL('../components/TechSpecsBrands.tsx', import.meta.url), 'utf8');

test('the three views of the brand list', () => {
  assert.deepEqual(BRAND_VIEWS.map((v) => v.label), ['Toutes les marques', 'Les plus consultées', 'Disponibles en Tunisie']);
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

test('the brand list uses the shared bar: sort, importer filter, sticky phone row', () => {
  assert.match(page, /sortOptions=\{BRAND_VIEWS\}/);
  assert.match(page, /extraFilters=\{extraFilters\}/);
  assert.match(page, /phoneLayout="inline"/);
  assert.doesNotMatch(page, /COUNTRIES|activeCountry/); // the hidden « Pays » filter is gone
  assert.match(page, /const showPopular = !brandSearch && view === 'all' && activeImporter === ALL_IMPORTERS;/);
  assert.match(page, /useState<BrandView>\(availableInTunisia \? 'tunisia' : 'all'\)/);
});
