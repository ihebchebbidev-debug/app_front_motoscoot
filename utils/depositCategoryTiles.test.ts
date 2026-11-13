import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { categoryTileImage } from './depositOptions';

// Lot C (2026-11-13): the category, first choice of the deposit, as photo tiles.
const step = readFileSync(new URL('../components/deposit/StepTechnical.tsx', import.meta.url), 'utf8');
const chips = readFileSync(new URL('../components/ui/ChoiceChips.tsx', import.meta.url), 'utf8');
const API = 'https://api.example.test';

test('the admin photo is served over https, as a 300 px thumbnail with the original for dense screens', () => {
  assert.deepEqual(categoryTileImage('http://motoscoot.ihebchebbi.pro/uploads/abc.webp', API), {
    src: `${API}/uploads/thumbnails/thumb_abc.webp`,
    srcSet: `${API}/uploads/thumbnails/thumb_abc.webp 300w, ${API}/uploads/abc.webp 1200w`,
  });
  assert.deepEqual(categoryTileImage('/uploads/abc.webp', API)?.src, `${API}/uploads/thumbnails/thumb_abc.webp`);
  assert.deepEqual(categoryTileImage('/assets/category-accessoires.jpg', API), { src: '/assets/category-accessoires.jpg' });
  assert.equal(categoryTileImage('http://elsewhere.example/x.png', API), null); // never mixed content
  assert.equal(categoryTileImage(null, API), null);
});

test('the category is four photo tiles, two columns on phones, four from 640 px', () => {
  assert.match(step, /name="category"\n\s+render=\{\(\{ field \}\) => \(\n\s+<ChoiceChips\n\s+variant="tiles"/);
  assert.match(chips, /tiles \? 'grid grid-cols-2 sm:grid-cols-4/);
  assert.doesNotMatch(step, /Choisir une catégorie/);
});

test('tile photos: lazy, sized, decorative, never a broken image', () => {
  assert.match(chips, /sizes="\(max-width: 639px\) 46vw, 210px"/);
  assert.match(chips, /loading="lazy"/);
  assert.match(chips, /alt=""/);
  assert.match(chips, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(chips, /group-hover:scale-\[1\.03\] motion-reduce:group-hover:scale-100/);
});
