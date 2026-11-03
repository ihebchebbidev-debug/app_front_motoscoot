import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareLink, NATIVE_SHARE_SOURCE } from './shareLinks.ts';

const ARTICLE = 'https://www.moto-scoot.tn/article/yamaha-rw350-le-petit-scooter-qui-voit-grand-bdb88e25-0527-41fa-af3f-8e09c2d7cfb5';

test('WhatsApp, Messenger and the phone share sheet get utm tags', () => {
  assert.equal(
    shareLink(ARTICLE, 'whatsapp', 'article'),
    `${ARTICLE}?utm_source=whatsapp&utm_medium=social&utm_campaign=partage-article`,
  );
  assert.match(shareLink(ARTICLE, 'messenger', 'tip'), /utm_source=messenger&utm_medium=social&utm_campaign=partage-guide$/);
  assert.match(shareLink(ARTICLE, NATIVE_SHARE_SOURCE, 'listing'), /utm_source=partage-mobile&.*utm_campaign=partage-annonce$/);
});

test('Facebook, LinkedIn and Instagram links stay clean', () => {
  for (const source of ['facebook', 'linkedin', 'instagram', 'copy_link']) {
    assert.equal(shareLink(ARTICLE, source, 'article'), ARTICLE);
  }
});

test('existing query parameters are kept and utm values replaced, not duplicated', () => {
  const tagged = new URL(shareLink(`${ARTICLE}?page=2&utm_source=old`, 'whatsapp', 'article'));
  assert.equal(tagged.searchParams.get('page'), '2');
  assert.deepEqual(tagged.searchParams.getAll('utm_source'), ['whatsapp']);
});

test('an unparsable URL is returned unchanged', () => {
  assert.equal(shareLink('/article/x', 'whatsapp', 'article'), '/article/x');
});
