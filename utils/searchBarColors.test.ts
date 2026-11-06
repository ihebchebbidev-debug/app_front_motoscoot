import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../components/search/SearchBar.tsx', import.meta.url), 'utf8');

test('palette tokens only: no hard-coded hex, no gray-400 text or icons, no capitals', () => {
  assert.doesNotMatch(src, /#1f2937|#111827/);
  assert.doesNotMatch(src, /text-gray-400/);
  assert.doesNotMatch(src, /uppercase|tracking-wider/);
  assert.match(src, /bg-gray-900 hover:bg-black/);
});

test('empty fields read as hints, chosen values as values', () => {
  assert.match(src, /\{display \|\| <span className="text-gray-500 font-normal">\{placeholder \|\| label\}<\/span>\}/);
  assert.match(src, /font-medium text-gray-900 truncate/);
});

test('contrast fixes: active tab, chosen option, « Autour de moi », empty messages', () => {
  assert.match(src, /tab === 'occasion' \? 'text-primary-700'/);
  assert.match(src, /const ACTIVE = 'bg-primary-50 text-primary-700 font-semibold';/);
  assert.match(src, /\$\{ITEM\} text-primary-700 flex items-center gap-2/);
  assert.doesNotMatch(src, /italic/);
  // Visible field edge and a keyboard focus ring on the field.
  assert.match(src, /'border-gray-300 md:hover:border-gray-400'/);
  assert.match(src, /has-\[button:focus-visible\]:outline-2/);
});
