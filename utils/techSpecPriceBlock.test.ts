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

test('price block of a 125 scooter: TTC price, checked month, availability, dealer, 125 prices + comparator links', () => {
  const b = techSpecPriceBlock({
    brand: 'SYM', model: 'Jet 14 EVO 125', category: 'Scooter', cc: '124.7 cc', price: 9000,
    updatedAt: '2026-11-01T19:54:01Z', availableInTunisia: true, importerName: 'Megacycle', importerCity: 'Sousse',
  });
  assert.deepEqual(b, {
    price: '9 000 DT TTC',
    checked: 'novembre 2026',
    availability: 'Commercialisé en Tunisie',
    dealer: 'Megacycle (Sousse)',
    links: [
      { href: '/prix/scooter-125-tunisie', label: 'Prix des scooters 125 neufs en Tunisie' },
      { href: '/comparateur', label: 'Comparer le SYM Jet 14 EVO 125 avec un autre modèle' },
    ],
  });
});

test('availability says "sold in Tunisia", never a stock level; "En arrivage" is kept as such', () => {
  assert.equal(techSpecPriceBlock({ availableInTunisia: false, price: 48000 }).availability, 'Non commercialisé en Tunisie');
  assert.equal(techSpecPriceBlock({ price: 48000 }).availability, null);
  const arriving = techSpecPriceBlock({ price: 'En arrivage', availableInTunisia: true });
  assert.equal(arriving.price, null);
  assert.equal(arriving.checked, null);
  assert.equal(arriving.availability, 'En arrivage en Tunisie');
  for (const b of [techSpecPriceBlock({ availableInTunisia: true }), techSpecPriceBlock({ availableInTunisia: false })]) {
    assert.equal(/stock/i.test(String(b.availability)), false);
  }
});

test('motorcycles get "la", and no 125 scooter price link', () => {
  const b = techSpecPriceBlock({ brand: 'Honda', model: 'X-ADV', category: 'Maxi Scooter', cc: '745 cc', price: 48000 });
  assert.deepEqual(b.links.map((l) => l.href), ['/comparateur']);
  assert.equal(techSpecPriceBlock({ brand: 'Yamaha', model: 'MT-07', category: 'Roadster', cc: '689 cc' }).links[0].label, 'Comparer la Yamaha MT-07 avec un autre modèle');
});
