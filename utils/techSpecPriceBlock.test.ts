import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDinars, techSpecPriceBlock } from './techSpecSeo.ts';

test('prices read "9 000 DT" with no-break spaces, whatever the stored format', () => {
  for (const raw of [9000, '9000', '9 000', '9 000 DT', '9 000 DT']) {
    assert.equal(formatDinars(raw), '9 000 DT', String(raw));
  }
  assert.equal(formatDinars('En arrivage'), null);
  assert.equal(formatDinars(null), null);
});

test('price block of a 125 scooter: dated price row, availability, dealer, 125 prices link', () => {
  const b = techSpecPriceBlock({
    brand: 'SYM', model: 'Jet 14 EVO 125', category: 'Scooter', cc: '124.7 cc', price: 9000,
    updatedAt: '2026-11-01T19:54:01Z', availableInTunisia: true, importerName: 'Megacycle', importerCity: 'Sousse',
  });
  assert.deepEqual(b, {
    priceLabel: 'Prix relevé en novembre 2026',
    price: '9 000 DT TTC',
    availability: 'Commercialisé en Tunisie',
    dealer: 'Megacycle (Sousse)',
    pricesLink: { href: '/prix/scooter-125-tunisie', label: 'Prix des scooters 125 neufs en Tunisie' },
  });
});

test('availability says "sold in Tunisia", never a stock level; "En arrivage" is kept as such', () => {
  assert.equal(techSpecPriceBlock({ availableInTunisia: false, price: 48000 }).availability, 'Non commercialisé en Tunisie');
  assert.equal(techSpecPriceBlock({ price: 48000 }).availability, null);
  assert.equal(techSpecPriceBlock({ price: 48000 }).priceLabel, 'Prix', 'undated price');
  const arriving = techSpecPriceBlock({ price: 'En arrivage', availableInTunisia: true });
  assert.equal(arriving.price, null);
  assert.equal(arriving.availability, 'En arrivage en Tunisie');
  for (const b of [techSpecPriceBlock({ availableInTunisia: true }), techSpecPriceBlock({ availableInTunisia: false })]) {
    assert.equal(/stock/i.test(String(b.availability)), false);
  }
});

test('no 125 prices link outside 125 cm³ scooters', () => {
  assert.equal(techSpecPriceBlock({ category: 'Maxi Scooter', cc: '745 cc', price: 48000 }).pricesLink, null);
  assert.equal(techSpecPriceBlock({ category: 'Roadster', cc: '125 cc', price: 11500 }).pricesLink, null);
});
