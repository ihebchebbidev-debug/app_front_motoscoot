import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { formatListingPrice } from './priceUtils';
import { canSelectComparisonId, parseComparisonIds } from './comparisonSelection';

describe('customer correction rules', () => {
  test('known home prices remain 2600, 10000, 1500 and 48000 DT', () => {
    for (const price of [2600, 10000, 1500, 48000]) {
      const expected = `${new Intl.NumberFormat('fr-FR').format(price)} DT`;
      assert.equal(formatListingPrice(price), expected);
      assert.equal(formatListingPrice(String(price)), expected);
      assert.equal(formatListingPrice(expected), expected);
    }
  });
  test('comparison retains only two slots from a shared link', () => {
    assert.deepEqual(parseComparisonIds('honda,ktm,sym'), ['honda', 'ktm']);
  });
  test('comparison rejects duplicate selections across slots', () => {
    assert.deepEqual(parseComparisonIds('honda,honda,ktm'), ['honda', 'ktm']);
    assert.equal(canSelectComparisonId(['honda', null], 1, 'honda'), false);
    assert.equal(canSelectComparisonId(['honda', null], 1, 'ktm'), true);
  });
});
import { isKnownPagePath } from './knownPages';

describe('real 404 for unknown addresses', () => {
  test('unknown address is not a known page', () => {
    assert.equal(isKnownPagePath('/zz-test'), false);
    assert.equal(isKnownPagePath('/audit-nonexistent-20261022'), false);
    assert.equal(isKnownPagePath('/annonce/a/b'), false);
  });
  test('real pages, short sheet and listing links stay known', () => {
    for (const p of ['/', '/comparateur', '/mentions-legales', '/fiche-technique/sym-jet-14-evo', '/annonce/voge-900-blacknight-2024-1', '/admin/avis', '/fiches-techniques/sym']) {
      assert.equal(isKnownPagePath(p), true, p);
    }
  });
});
