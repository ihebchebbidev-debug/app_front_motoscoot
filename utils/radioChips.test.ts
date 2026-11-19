import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { radioTabIndex, nextRadioIndex } from './radioChips';

const bar = readFileSync(new URL('../components/ui/FilterBar.tsx', import.meta.url), 'utf8');
const sheet = readFileSync(new URL('../components/search/ChoiceSheet.tsx', import.meta.url), 'utf8');

test('Tab lands on the chosen chip, else the first usable one', () => {
  const opts = ['Tout', 'SODIV', 'SLC'];
  assert.deepEqual(opts.map((_, i) => radioTabIndex(opts, i, (o) => o === 'SODIV', () => false)), [-1, 0, -1]);
  assert.deepEqual(opts.map((_, i) => radioTabIndex(opts, i, () => false, (o) => o === 'Tout')), [-1, 0, -1]);
});

test('arrows move to the next usable chip and wrap; Home / End', () => {
  const off = (k: number) => k === 1;
  assert.equal(nextRadioIndex('ArrowRight', 0, 4, off), 2); // skips the empty chip
  assert.equal(nextRadioIndex('ArrowDown', 3, 4, off), 0); // wraps
  assert.equal(nextRadioIndex('ArrowLeft', 0, 4, off), 3);
  assert.equal(nextRadioIndex('ArrowUp', 2, 4, off), 0);
  assert.equal(nextRadioIndex('Home', 3, 4, (k) => k === 0), 1);
  assert.equal(nextRadioIndex('End', 0, 4, (k) => k === 3), 2);
  assert.equal(nextRadioIndex('Enter', 0, 4, off), null);
});

test('filter panel: single-choice chips are radio buttons, no on/off toggles left', () => {
  assert.doesNotMatch(bar, /aria-pressed/);
  assert.equal((bar.match(/role="radiogroup"/g) || []).length, 3);
  assert.match(bar, /role="radiogroup" aria-labelledby=\{`fb-\$\{filter\.id\}-title`\} onKeyDown=\{onRadioKeyDown\}/);
  assert.match(bar, /aria-checked=\{filter\.value === opt\}/);
  // The sheet's Tab loop skips the chips that are not the chosen one.
  assert.match(sheet, /el\.offsetParent !== null && el\.tabIndex >= 0/);
});
