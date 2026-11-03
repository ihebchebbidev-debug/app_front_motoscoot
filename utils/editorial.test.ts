import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareBodyImages } from './editorial';

describe('article body images', () => {
  test('missing or empty alt gets the article title and the photo number', () => {
    const out = prepareBodyImages('<p><img src="/a.webp"><img src="/b.webp" alt=""></p>', 'Yamaha RW700');
    assert.match(out, /<img src="\/a\.webp" alt="Yamaha RW700 \(photo 1\)"/);
    assert.match(out, /<img src="\/b\.webp" alt="Yamaha RW700 \(photo 2\)"/);
  });

  test('an existing alt is kept', () => {
    const out = prepareBodyImages('<img src="/a.webp" alt="Vue de profil">', 'Titre');
    assert.match(out, /alt="Vue de profil"/);
    assert.doesNotMatch(out, /Titre/);
  });

  test('every image but the first is lazy; all decode asynchronously', () => {
    const out = prepareBodyImages('<img src="/a.webp"><img src="/b.webp"><img src="/c.webp" loading="eager">', 'T');
    const imgs = out.match(/<img[^>]*>/g) ?? [];
    assert.doesNotMatch(imgs[0], /loading=/);
    assert.match(imgs[1], /loading="lazy"/);
    assert.match(imgs[2], /loading="eager"/);
    assert.equal(imgs.filter((i) => /decoding="async"/.test(i)).length, 3);
  });

  test('the title is escaped inside the attribute', () => {
    const out = prepareBodyImages('<img src="/a.webp">', 'Essai "XL" <2026>');
    assert.match(out, /alt="Essai &quot;XL&quot; &lt;2026&gt; \(photo 1\)"/);
  });
});
