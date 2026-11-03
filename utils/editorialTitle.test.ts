import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editorialTitle, titleFitsBrandSuffix, MAX_TITLE_LENGTH } from './editorial.ts';

test('short titles keep the brand suffix', () => {
  assert.equal(editorialTitle('Comment bien graisser son kit chaîne ?'), 'Comment bien graisser son kit chaîne ? | Moto-Scoot.tn');
});

test('titles that would pass 60 characters are served without the suffix', () => {
  const long = 'Yamaha RW700 : le scooter qui a avalé une Ténéré 700';
  assert.equal(titleFitsBrandSuffix(long), false);
  assert.equal(editorialTitle(long), long);
});

test('the limit is inclusive', () => {
  const exact = 'x'.repeat(MAX_TITLE_LENGTH - ' | Moto-Scoot.tn'.length);
  assert.equal(editorialTitle(exact).length, MAX_TITLE_LENGTH);
  assert.equal(editorialTitle(exact + 'x'), exact + 'x');
});
