import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHubState, defaultHubState } from './techSpecHubState';

const page = readFileSync(new URL('../components/TechSpecsBrands.tsx', import.meta.url), 'utf8');

test('brand list: a saved state comes back field by field', () => {
  const saved = JSON.stringify({ view: 'popular', importer: 'SODIV', inTunisia: true, q: 'sym' });
  assert.deepEqual(parseHubState(saved), { view: 'popular', importer: 'SODIV', inTunisia: true, q: 'sym' });
});

test('brand list: anything odd falls back to the default', () => {
  assert.equal(parseHubState(null), null);
  assert.equal(parseHubState('{oops'), null);
  // « tunisia » is no longer a sort (it is the switch).
  assert.deepEqual(parseHubState(JSON.stringify({ view: 'tunisia', importer: 3, inTunisia: 'yes', q: 'x'.repeat(200) })), defaultHubState());
  assert.equal(defaultHubState(true).inTunisia, true);
});

test('brand list: choices come back only on Back, and never go in the address', () => {
  assert.match(page, /navigationType === 'POP' && readHubState\(\)/);
  assert.match(page, /saveHubState\(\{ view, importer: activeImporter, inTunisia, q: brandSearch \}\)/);
  assert.doesNotMatch(page, /setSearchParams|history\.replaceState/);
});
