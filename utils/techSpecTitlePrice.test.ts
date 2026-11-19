import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { techSpecTitle } from './techSpecSeo';

// Owner, 2026-11-19: a sheet's title says « Prix en Tunisie » only when the
// sheet has a price; 50 of 101 sheets promised a price they did not show.

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const WITH = 'SYM Jet 14 EVO 125 | Prix en Tunisie & Fiche Technique';
const WITHOUT = 'Yamaha TMAX 560 | Fiche Technique & Caractéristiques';

test('a price in DT (raw or formatted) keeps « Prix en Tunisie »', () => {
  for (const price of ['9000', 9000, '9 000 DT', '9 000 DT', 'À partir de 9 000 DT'])
    assert.equal(techSpecTitle({ brand: 'SYM', model: 'Jet 14 EVO 125', price }), WITH, String(price));
});

test('no price: no promise of a price', () => {
  for (const price of [null, undefined, '', '—', 'En arrivage', 'Prochainement', 'Pas encore dévoilé', 'Sur demande', '0'])
    assert.equal(techSpecTitle({ brand: 'Yamaha', model: 'TMAX 560', price }), WITHOUT, String(price));
});

test('the React page and the HTML Google receives pass the price', () => {
  assert.match(read('../components/TechSpecsDetails.tsx'), /title=\{techSpecTitle\(\{ brand: spec\.brand, model: spec\.model, price: spec\.priceNew \}\)\}/);
  assert.match(read('../api/og-prerender.ts'), /return techSpecTitle\(\{ brand: d\.brand, model: d\.model, price: d\.price_new \}\);/);
});
