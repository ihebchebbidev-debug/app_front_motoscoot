import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSpecNumber, parseSpecPrice } from './techSpecSeo';
import { parseCc } from '../api/og-prerender';

test('engine size: "124.7 cc" is 124.7, never 1247', () => {
  assert.equal(parseSpecNumber('124.7 cc'), 124.7);
  assert.equal(parseSpecNumber('124,7 cm³'), 124.7);
  assert.equal(parseSpecNumber('125'), 125);
  assert.equal(parseSpecNumber(689), 689);
  assert.equal(parseSpecNumber(''), null);
  assert.equal(parseSpecNumber(null), null);
  assert.equal(parseSpecNumber('électrique'), null);
});

test('the crawler HTML and the page read engine size through the same rule', () => {
  assert.equal(parseCc, parseSpecNumber);
  const page = readFileSync(new URL('../components/TechSpecsDetails.tsx', import.meta.url), 'utf8');
  assert.match(page, /engineDisplacement:[\s\S]{0,80}value: parseSpecNumber\(spec\.engine\.cc\)/);
  assert.doesNotMatch(page, /engine\.cc\)\.replace\(\/\[\^\\d\]\/g/);
});

test('new price: one rule for every way the admin types it', () => {
  const cases: [unknown, number | null][] = [
    ['9000', 9000], [9000, 9000], ['3 149 DT', 3149], ['4 679 DT', 4679], ['9 000 DT', 9000],
    ['3699 DT', 3699], ['9.000 DT', 9000], ['12.500.000', 12500000],
    ['6199.500', 6199.5], ['6 199,500 DT', 6199.5], ['6 199,5 DT', 6199.5],
    ['À partir de 35 000 DT (selon finition)', 35000], ['35 000 DT, garantie 2 ans', 35000],
    ['Prix 2026 : 9 000 DT', 9000], ['9 000 TND', 9000],
    ['Sur demande', null], ['En arrivage', null], ['Pas encore dévoilé', null], ['—', null], ['', null], [null, null], ['0', null],
  ];
  for (const [input, expected] of cases) assert.equal(parseSpecPrice(input), expected, String(input));
});

test('the page, the crawler HTML and the SEO texts read the price through that rule', () => {
  const page = readFileSync(new URL('../components/TechSpecsDetails.tsx', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../api/og-prerender.ts', import.meta.url), 'utf8');
  assert.equal((page.match(/parseSpecPrice\(spec\.priceNew\)/g) || []).length, 2);
  assert.match(server, /const parsePrice = parseSpecPrice;/);
  assert.doesNotMatch(page, /priceNew \|\| ''\)\.replace\(\/\[\^\\d\]\/g/);
});
