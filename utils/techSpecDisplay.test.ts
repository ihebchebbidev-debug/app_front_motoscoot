import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ccLabel, powerLabel, torqueLabel, priceLabel } from './techSpecDisplay';

const NBSP = String.fromCharCode(0xa0);
const card = readFileSync(new URL('../components/tech-specs/TechSpecModelCard.tsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../components/TechSpecsModels.tsx', import.meta.url), 'utf8');

test('card values are short, in one unit, French decimals', () => {
  assert.equal(ccLabel('124.6 CC'), '124,6 cc');
  assert.equal(ccLabel('399 cm³'), '399 cc');
  assert.equal(powerLabel('9.3 kW (12.6 ch) à 8000 tr/min'), '12,6 ch'); // was cut on the card
  assert.equal(powerLabel('11.4 ch à 8500 tr/min'), '11,4 ch');
  assert.equal(powerLabel('6.5 kW'), '8,8 ch');
  assert.equal(torqueLabel('10.3 Nm à 6500 tr/min'), '10,3 Nm');
  assert.equal(ccLabel(''), '—');
});

test('a price reads as a price, a state as a state', () => {
  assert.deepEqual(priceLabel('9000DT'), { kind: 'price', text: `9${NBSP}000${NBSP}DT` });
  assert.deepEqual(priceLabel('À partir de 35 000 DT'), { kind: 'price', text: `Dès${NBSP}35${NBSP}000${NBSP}DT` });
  assert.deepEqual(priceLabel('En arrivage'), { kind: 'status', text: 'En arrivage' });
  assert.deepEqual(priceLabel('Épuisé (29000 DT)'), { kind: 'status', text: 'Épuisé (29000 DT)' });
  assert.deepEqual(priceLabel(''), { kind: 'status', text: 'Prix non annoncé' });
});

test('the card answers the finger within 100 ms, hover only with a mouse', () => {
  assert.match(card, /transition-\[transform,box-shadow,border-color\] duration-100 ease-out active:scale-\[0\.97\]/);
  assert.doesNotMatch(card, /transition-all duration-300/);
  assert.doesNotMatch(card, /[" ]hover:shadow/); // gated by [@media(hover:hover)]
});

test('card text is readable and follows the phone text size (rem, no 8-11 px capitals)', () => {
  assert.doesNotMatch(card, /text-\[(8|9|10|11)px\]/);
  assert.doesNotMatch(card, /uppercase/);
  assert.match(card, /SpecLabel: "text-xs md:text-\[0\.625rem\] lg:text-xs font-medium text-gray-600"/);
  // Dark orange: 5:1 on white (the lighter orange was 3.7:1). The button stays.
  assert.match(card, /PriceValue: "[^"]*text-primary-700/);
  assert.match(card, /DetailsButton: "mt-auto w-full min-h-11 bg-primary-700 text-white/);
  assert.match(card, /Fiche technique <ArrowRight/);
});

test('brand page on phones: one line per model, no slide-in', () => {
  assert.match(page, /highlightTerms=\{highlightTerms\}\s+rowOnPhone/);
  assert.doesNotMatch(page, /<Reveal/);
  assert.match(card, /Row: "max-sm:flex-row/);
  assert.match(page, /md:grid-cols-3 xl:grid-cols-4/); // no 141 px cards on tablets
});
