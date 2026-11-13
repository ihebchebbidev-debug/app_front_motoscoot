import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSpecNumber } from './techSpecSeo';
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
