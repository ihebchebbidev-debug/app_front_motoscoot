import { test } from 'node:test';
import assert from 'node:assert/strict';
import { similarTechSpecs } from './techSpecSeo.ts';

// Prices and displacements as stored (mixed formats), from the live catalogue.
const CATALOGUE = [
  { id: 1, slug: 'sym-jet-14-evo-125', brand: 'SYM', model: 'Jet 14 EVO 125', category: 'Scooter', cc: '124.7 cc', price: 9000 },
  { id: 2, slug: 'sym-jet-x-125', brand: 'SYM', model: 'Jet X 125', category: 'Scooter', cc: '125 cc', price: 9399 },
  { id: 3, slug: 'peugeot-tweet-125-fl', brand: 'Peugeot', model: 'Tweet 125 FL', category: 'Scooter', cc: '124.6 cc', price: '9 500 DT' },
  { id: 4, slug: 'piaggio-vespa-vxl-125', brand: 'Piaggio', model: 'Vespa VXL 125', category: 'Scooter', cc: '124.45 cc', price: 9900 },
  { id: 5, slug: 'teyin-lm-adv-125', brand: 'Teyin', model: 'LM ADV 125', category: 'Scooter', cc: '124 cc', price: '10 350' },
  { id: 6, slug: 'kymco-people-s-125', brand: 'Kymco', model: 'People S 125', category: 'Scooter', cc: '124.6 cc', price: 10600 },
  { id: 7, slug: 'zontes-125-x', brand: 'Zontes', model: '125 X', category: 'Scooter', cc: '125 cc', price: 'En arrivage' },
  { id: 8, slug: 'peugeot-pm-01', brand: 'Peugeot', model: 'PM-01', category: 'Roadster', cc: '124.8 cc', price: '11 500' },
  { id: 9, slug: 'sym-adx-300', brand: 'SYM', model: 'ADX 300', category: 'Scooter', cc: '278 cc', price: 15000 },
  { id: 10, slug: 'sym-jet-4-rx-125', brand: 'SYM', model: 'Jet 4 RX 125', category: 'Scooter', cc: '124.6 cc', price: 6199 },
];

test('SYM Jet 14 EVO 125: the 4 closest-priced 125 scooters, with links and TTC prices', () => {
  assert.deepEqual(similarTechSpecs(CATALOGUE[0], CATALOGUE), [
    { href: '/fiche-technique/sym-jet-x-125', name: 'SYM Jet X 125', price: '9 399 DT TTC' },
    { href: '/fiche-technique/peugeot-tweet-125-fl', name: 'Peugeot Tweet 125 FL', price: '9 500 DT TTC' },
    { href: '/fiche-technique/piaggio-vespa-vxl-125', name: 'Piaggio Vespa VXL 125', price: '9 900 DT TTC' },
    { href: '/fiche-technique/teyin-lm-adv-125', name: 'Teyin LM ADV 125', price: '10 350 DT TTC' },
  ]);
});

test('never itself, a priceless sheet, another family or another displacement class', () => {
  const slugs = similarTechSpecs(CATALOGUE[0], CATALOGUE, 10).map((m) => m.href);
  for (const excluded of ['sym-jet-14-evo-125', 'zontes-125-x', 'peugeot-pm-01', 'sym-adx-300']) {
    assert.equal(slugs.includes(`/fiche-technique/${excluded}`), false, excluded);
  }
});

test('a sheet without price falls back to the closest displacement; empty when nothing matches', () => {
  assert.equal(similarTechSpecs({ slug: 'x', category: 'Scooter', cc: '125 cc', price: 'En arrivage' }, CATALOGUE, 1)[0].href, '/fiche-technique/sym-jet-x-125');
  assert.deepEqual(similarTechSpecs({ slug: 'y', category: 'Trail', cc: '700 cc', price: 30000 }, CATALOGUE), []);
});
