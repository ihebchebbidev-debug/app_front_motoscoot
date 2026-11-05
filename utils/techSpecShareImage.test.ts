import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { techSpecShareImage } from './techSpecSeo.ts';

test('a shared sheet shows the first gallery photo, not the brand-page card picture', () => {
  assert.equal(
    techSpecShareImage({ image: '/uploads/carte.webp', gallery: ['/uploads/galerie-1.webp', '/uploads/galerie-2.webp'] }),
    '/uploads/galerie-1.webp',
  );
});

test('a sheet without gallery falls back to its main picture', () => {
  assert.equal(techSpecShareImage({ image: '/uploads/carte.webp', gallery: [] }), '/uploads/carte.webp');
  assert.equal(techSpecShareImage({ image: '/uploads/carte.webp', gallery: ['', null] }), '/uploads/carte.webp');
  assert.equal(techSpecShareImage({}), null);
});

test('crawler preview and React page both use the shared picture', () => {
  assert.match(readFileSync('api/og-prerender.ts', 'utf8'), /techSpecShareImage\(doc\)/);
  const page = readFileSync('components/TechSpecsDetails.tsx', 'utf8');
  assert.match(page, /image=\{shareImage\}/);
  assert.match(page, /image: shareImage/);
  assert.doesNotMatch(page, /image=\{spec\.image\}|image: spec\.image,/);
});
