import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Shared by the listing page and the technical sheet (ListingDetails, TechSpecsDetails).
const gallery = readFileSync('components/listing/ListingGallery.tsx', 'utf8');

test('the main photo is 4:3 at every width, whole on desktop', () => {
  assert.match(gallery, /GalleryMain: "relative aspect-\[4\/3\] /);
  assert.doesNotMatch(gallery, /aspect-video/);
  assert.match(gallery, /fit === 'contain' \? 'md:object-contain'/);
});

test('no thumbnail strip under the main photo; full screen keeps its own', () => {
  assert.doesNotMatch(gallery, /ThumbsWrapper|S\.Thumb\(/);
  assert.match(gallery, /BottomRail/);
  assert.match(gallery, /aria-label="Photo suivante"/);
});

test('both pages use the shared gallery', () => {
  for (const page of ['components/ListingDetails.tsx', 'components/TechSpecsDetails.tsx']) {
    assert.match(readFileSync(page, 'utf8'), /<ListingGallery/);
  }
});

test('near-4:3 photos fill the frame, portrait and very wide ones are shown whole', async () => {
  const { photoFit } = await import('./photoFit.ts');
  assert.equal(photoFit(1600, 1200), 'cover');
  assert.equal(photoFit(1600, 1063), 'cover');   // 3:2, Peugeot XP 400
  assert.equal(photoFit(900, 1200), 'contain');  // 3:4 phone photo
  assert.equal(photoFit(1920, 1080), 'contain'); // 16:9
  assert.equal(photoFit(0, 0), 'cover');
});

test('photo arrows are plain white buttons with an orange arrow, no glass', () => {
  const btn = gallery.match(/GalleryBtn: "([^"]+)"/)![1];
  assert.match(btn, /\bbg-white\b/);
  assert.match(btn, /\btext-primary-600\b/);
  assert.doesNotMatch(btn, /backdrop-blur|bg-card\/|text-gray-900/);
  assert.doesNotMatch(gallery, /<Button variant="ghost" aria-label="Photo (précédente|suivante)"/);
});

test('the technical sheet shows every block at load, nothing waits for a scroll', () => {
  assert.doesNotMatch(readFileSync('components/TechSpecsDetails.tsx', 'utf8'), /<Reveal\b/);
});
