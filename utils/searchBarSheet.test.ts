import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../components/search/SearchBar.tsx', import.meta.url), 'utf8');

const sheet = readFileSync(new URL('../components/search/ChoiceSheet.tsx', import.meta.url), 'utf8');

test('the choice sheets render in document.body, above the header and the cookie banner', () => {
  assert.match(src, /<ChoiceSheet\s+open=\{isOpen && !isDisabled\}/);
  assert.match(sheet, /import \{ createPortal \} from 'react-dom';/);
  assert.match(sheet, /data-searchbar-sheet=""/);
  assert.match(sheet, /<\/div>,\s*document\.body,\s*\);/);
});

test('a tap inside the open sheet is not treated as a tap outside the search card', () => {
  assert.match(src, /if \(\(target as Element\)\.closest\?\.\('\[data-searchbar-sheet\]'\)\) return;/);
});

// « Modèle » without a brand used to list the whole reference catalogue
// (138 models of every brand and category, nearly none with a listing).
test('« Modèle » is inactive until a brand is chosen (accessories: until an article is chosen)', () => {
  assert.match(src, /isDisabled=\{type === 'Accessoires' \? !accessoryCategory : !brand\}/);
  assert.match(src, /disabledHint=\{type === 'Accessoires' \? 'Choisissez d’abord un article' : 'Choisissez d’abord une marque'\}/);
  // The hint is on the frame (a disabled button shows no tooltip) and read by screen readers.
  assert.match(src, /title=\{isDisabled \? disabledHint : undefined\}/);
  assert.match(src, /aria-description=\{isDisabled \? disabledHint : undefined\}/);
});

test('the model catalogue is not downloaded before a brand is chosen', () => {
  assert.match(src, /useModelsByBrand\(brand \|\| undefined, activeAccessoryType, !!brand \|\| !!activeAccessoryType\)/);
  const ref = readFileSync(new URL('../hooks/useReferenceData.ts', import.meta.url), 'utf8');
  assert.match(ref, /export const useModels = \(brand\?: string, accessoryType\?: string, enabled = true\) =>/);
  assert.match(ref, /queryFn: \(\{ signal \}\) => referenceApi\.getModels\(brand, signal, accessoryType\),\n    enabled,/);
});
