import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchTechSpecsLocally } from './techSpecsSearch';
import type { TechSpec } from '../types';

const spec = (brand: string, model: string, year: number, extra: Partial<TechSpec> = {}) =>
  ({ id: `${brand}-${model}`, brand, model, year, category: 'Scooter', engine: { cc: '125 cc' }, ...extra }) as unknown as TechSpec;

const catalogue = [
  spec('SYM', 'Jet 14 125 Carburateur', 2025),
  spec('SYM', 'Jet 14 EVO 125', 2026),
  spec('SYM', 'Jet X 125', 2026),
  spec('Peugeot', 'Django 125', 2026, { engine: { cc: '125 cc' } as any }),
  spec('Voge', '300 Rally', 2026, { engine: { cc: '292 cc' } as any }),
];

test('a model name finds its sheets (« jet 14 », « sym jet », « 14 evo »)', () => {
  assert.deepEqual(searchTechSpecsLocally(catalogue, 'jet 14').map((s) => s.model), ['Jet 14 EVO 125', 'Jet 14 125 Carburateur']);
  assert.equal(searchTechSpecsLocally(catalogue, 'sym jet').length, 3);
  assert.deepEqual(searchTechSpecsLocally(catalogue, 'Jet 14 évo').map((s) => s.model), ['Jet 14 EVO 125']);
  assert.deepEqual(searchTechSpecsLocally(catalogue, 'kawasaki'), []);
});

test('name matches come before spec matches, limit kept', () => {
  // « 125 » is in the names of four sheets and the engine of all but Voge.
  assert.equal(searchTechSpecsLocally(catalogue, '125').length, 4);
  assert.equal(searchTechSpecsLocally(catalogue, '125', 2).length, 2);
  assert.deepEqual(searchTechSpecsLocally(catalogue, '300').map((s) => s.model), ['300 Rally']);
});

test('the hub falls back to the local search when the server search fails', () => {
  const hook = readFileSync(new URL('../hooks/useTechSpecs.ts', import.meta.url), 'utf8');
  assert.match(hook, /return await techSpecsApi\.searchAll\(term, 30, \{ availableInTunisia, signal \}\);/);
  assert.match(hook, /if \(signal\?\.aborted\) throw err;\s+return searchTechSpecsLocally\(await localSearchCatalogue\(\), term, 30\);/);
  const page = readFileSync(new URL('../components/TechSpecsBrands.tsx', import.meta.url), 'utf8');
  assert.match(page, /const hideBrandGrid = !!brandSearch && searchingModels && filteredBrands\.length === 0 && matchingSpecs\.length > 0;/);
});
