import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { movePhoto, makeMainPhoto, cropOutputSize, CROP_RATIOS } from './depositPhotos.ts';

test('photos can be moved, and the list is never mutated', () => {
  const list = ['a', 'b', 'c', 'd'];
  assert.deepEqual(movePhoto(list, 3, 1), ['a', 'd', 'b', 'c']);
  assert.deepEqual(movePhoto(list, 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(movePhoto(list, 1, 9), list);
  assert.deepEqual(list, ['a', 'b', 'c', 'd']);
});

test('"Principale" puts the photo first and keeps the others in order', () => {
  assert.deepEqual(makeMainPhoto(['a', 'b', 'c', 'd'], 2), ['c', 'a', 'b', 'd']);
  assert.deepEqual(makeMainPhoto(['a', 'b'], 0), ['a', 'b']);
});

test('a crop keeps the real pixels, scaled down to 2000 px at most', () => {
  assert.deepEqual(cropOutputSize({ x: 0, y: 0, width: 1200, height: 900 }), { width: 1200, height: 900 });
  assert.deepEqual(cropOutputSize({ x: 10, y: 20, width: 4000, height: 3000 }), { width: 2000, height: 1500 });
  assert.deepEqual(cropOutputSize({ x: 0, y: 0, width: 0.4, height: 0 }), { width: 1, height: 1 });
});

test('the default crop frame is the 4:3 listing-card format', () => {
  assert.equal(CROP_RATIOS[0].id, '4:3');
});

test('the deposit gallery wires reorder, main photo and crop (no more empty crop button)', () => {
  const step = readFileSync('components/deposit/StepMedia.tsx', 'utf8');
  assert.doesNotMatch(step, /onCropImage=\{\(\) => \{\}\}/);
  const hook = readFileSync('hooks/useMediaUpload.ts', 'utf8');
  for (const fn of ['handleReorder', 'handleSetMain', 'handleCropDone']) assert.match(hook, new RegExp(fn));
  const deposit = readFileSync('components/DepositAd.tsx', 'utf8');
  for (const prop of ['onReorder', 'onSetMain', 'onCropDone']) assert.match(deposit, new RegExp(prop));
});

test('the line under the gallery never hides a failed photo', async () => {
  const { gallerySummary } = await import('./depositPhotos.ts');
  const ok = { status: 'success' as const }, up = { status: 'uploading' as const }, ko = { status: 'error' as const };
  assert.equal(gallerySummary([]), null);
  assert.deepEqual(gallerySummary([ok]), { text: '1 photo prête.', failed: 0 });
  assert.deepEqual(gallerySummary([ok, ok, ok, ok, up, ko]), { text: "4 photos prêtes, 1 en cours d'envoi, 1 en échec. Réessayez ou supprimez la photo en échec.", failed: 1 });
  assert.deepEqual(gallerySummary([ko, ko]), { text: '2 en échec. Réessayez ou supprimez les photos en échec.', failed: 2 });
});

test('the crop window is rendered at the page root and closes only on a real backdrop click', () => {
  const dialog = readFileSync('components/common/PhotoCropDialog.tsx', 'utf8');
  assert.match(dialog, /createPortal\(/);
  assert.match(dialog, /pressedOnBackdrop\.current && e\.target === e\.currentTarget/);
  assert.doesNotMatch(dialog, /backdrop-blur/);
});

test('the gallery keeps the app-screen rules: no gradient, blur, tiny text or tracked capitals', () => {
  const src = readFileSync('components/deposit/MediaUploader.tsx', 'utf8');
  assert.doesNotMatch(src, /bg-gradient-|backdrop-blur|text-\[(7|8|9|10)px\]|tracking-widest|shadow-(sm|md|lg)/);
});

test('spec-sheet admin uploads offer cropping with the shared crop window', () => {
  for (const f of ['components/admin/AdminImageUpload.tsx', 'components/admin/AdminGalleryUpload.tsx']) {
    const src = readFileSync(f, 'utf8');
    assert.match(src, /import\('\.\.\/common\/PhotoCropDialog'\)/);
    assert.match(src, /crop = false/);
  }
  const tab = readFileSync('components/admin/TechSpecsTab.tsx', 'utf8');
  assert.equal((tab.match(/\n\s+crop\n/g) || []).length, 2);
});

test('brand logos in reference data can be uploaded and are shown whole', () => {
  const tab = readFileSync('components/admin/ReferenceTab.tsx', 'utf8');
  assert.match(tab, /\{ name: 'logo_url', label: 'Logo', type: 'logo' \}/);
  assert.equal((tab.match(/fit="contain"/g) || []).length, 2); // add form + inline edit
  assert.match(readFileSync('components/admin/AdminImageUpload.tsx', 'utf8'), /fit === 'contain' \? 'object-contain/);
});
