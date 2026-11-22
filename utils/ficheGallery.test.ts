import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { galleryPhotoAlt, isOwnImage } from './seoImagePath';
import { techSpecPhotos, techSpecShareImage } from './techSpecSeo';
import { renderFicheBody } from '../api/og-prerender';

// Owner, 2026-11-22: Google saw one photo per sheet (alt = page title, lazy);
// the first two results show 24 and 28. Every photo is now in the page, each
// with its own description, the first one loaded first.

const sheet = {
  brand: 'SYM', model: 'Jet 14 EVO 125', year: 2026, category: 'Scooter', price_new: '9000',
  image: 'https://www.moto-scoot.tn/uploads/card.webp',
  gallery: ['https://www.moto-scoot.tn/uploads/a.webp', 'https://www.moto-scoot.tn/uploads/b.webp', 'https://www.moto-scoot.tn/uploads/c.webp'],
};

test('each photo has its own description', () => {
  assert.equal(galleryPhotoAlt('SYM Jet 14 EVO 125 2026', 1, 3), 'SYM Jet 14 EVO 125 2026, photo 2 sur 3');
  assert.equal(galleryPhotoAlt('SYM Jet 14 EVO 125 2026', 0, 1), 'SYM Jet 14 EVO 125 2026');
});

test('photos: the gallery, or the main image when there is no gallery; first = shared preview', () => {
  assert.deepEqual(techSpecPhotos(sheet), sheet.gallery);
  assert.deepEqual(techSpecPhotos({ image: 'x.webp', gallery: [] }), ['x.webp']);
  assert.equal(techSpecPhotos(sheet)[0], techSpecShareImage(sheet));
});

test('crawler HTML: every photo with its description, versioned, for crawlers without JavaScript only', () => {
  const html = renderFicheBody(sheet as any);
  assert.match(html, /<h2>Photos SYM Jet 14 EVO 125<\/h2>/);
  const noscript = html.slice(html.indexOf('<noscript>'), html.indexOf('</noscript>'));
  for (const [i, f] of [[1, 'a'], [2, 'b'], [3, 'c']] as const) {
    assert.match(noscript, new RegExp(`<img src="https://www\\.moto-scoot\\.tn/m/sym-jet-14-evo-125-2026/${f}\\.webp\\?v=2" alt="SYM Jet 14 EVO 125 2026, photo ${i} sur 3" width="1200" height="900" loading="lazy" />`));
  }
  // Nothing outside <noscript>: browsers that run the page download no extra photo.
  assert.equal((html.replace(noscript, '').match(/<img /g) || []).length, 0);
  assert.ok(html.indexOf('Photos SYM') < html.indexOf('Prix neuf en Tunisie'));
});

test('the old lazy image with the page title as alt is gone from sheets', () => {
  const api = readFileSync(new URL('../api/og-prerender.ts', import.meta.url), 'utf8');
  assert.match(api, /\$\{kind !== 'fiche-technique' && image && image !== DEFAULT_OG \?/);
});

test('the sheet page shows every photo as a described thumbnail; main photo first in priority', () => {
  const gallery = readFileSync(new URL('../components/listing/ListingGallery.tsx', import.meta.url), 'utf8');
  assert.match(gallery, /alt=\{galleryPhotoAlt\(title, activeIndex, images\.length\)\}/);
  assert.match(gallery, /fetchPriority=\{activeIndex === 0 \? 'high' : 'auto'\}/);
  assert.match(gallery, /\{thumbnails && images\.length > 1 && \(/);
  assert.match(gallery, /alt=\{galleryPhotoAlt\(title, idx, images\.length\)\}/);
  const page = readFileSync(new URL('../components/TechSpecsDetails.tsx', import.meta.url), 'utf8');
  assert.match(page, /title=\{techSpecGalleryTitle\(spec\)\}\s*thumbnails/);
  assert.match(page, /return techSpecPhotos\(spec\);/);
});

// Owner, 2026-11-22 (« je veux être à 100 % » in SE Ranking): photos linked
// from another site (Moto Morini answers 403, BMW times out) were counted as
// « 4XX images ». The crawler HTML and the Product data only list photos
// served by the site; the page still shows every photo to visitors.
test('photos hosted on another site stay out of the crawler HTML', () => {
  const html = renderFicheBody({ ...sheet, gallery: ['https://motomorini.eu/wp-content/uploads/x.png', ...sheet.gallery] } as any);
  assert.doesNotMatch(html, /motomorini\.eu/);
  assert.match(html, /photo 1 sur 3/);
  assert.equal(isOwnImage('https://www.bmw-motorrad.fr/a.jpg'), false);
  assert.equal(isOwnImage('/uploads/a.webp'), true);
  assert.equal(isOwnImage('https://motoscoot.ihebchebbi.pro/uploads/a.webp'), true);
});

test('Product data: the page photos, in the same order, none from another site', () => {
  const api = readFileSync(new URL('../api/og-prerender.ts', import.meta.url), 'utf8');
  assert.match(api, /const gallery = Array\.from\(new Set\(techSpecPhotos\(d\)\.filter\(isOwnImage\)/);
  assert.doesNotMatch(api, /function pickGallery/);
});
