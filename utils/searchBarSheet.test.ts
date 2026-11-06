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
