import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hero = readFileSync(new URL('../components/tech-specs/TechSpecsHero.tsx', import.meta.url), 'utf8');
const hub = readFileSync(new URL('../components/TechSpecsBrands.tsx', import.meta.url), 'utf8');

test('hero photo: fetched from 768 px only (phones hide it)', () => {
  assert.match(hero, /<source media="\(min-width: 768px\)" srcSet=\{desktopUrl\} \/>/);
  assert.doesNotMatch(hero, /<img\s+src=\{desktopUrl\}/);
});

test('brand list: the Tunisia list is asked for only once its switch is on', () => {
  assert.match(hub, /useTechSpecsBrands\(\{ availableInTunisia: true \}, inTunisia\)/);
});
