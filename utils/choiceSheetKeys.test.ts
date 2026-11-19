import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextOptionIndex } from '../components/search/ChoiceSheet';

const sheet = readFileSync(new URL('../components/search/ChoiceSheet.tsx', import.meta.url), 'utf8');

test('choice lists: ↓ ↑ Home End move between choices, no wrap', () => {
  assert.equal(nextOptionIndex('ArrowDown', 0, 3), 1);
  assert.equal(nextOptionIndex('ArrowDown', 2, 3), 2);
  assert.equal(nextOptionIndex('ArrowUp', 0, 3), 0);
  assert.equal(nextOptionIndex('Home', 2, 3), 0);
  assert.equal(nextOptionIndex('End', 0, 3), 2);
  // From the panel or the search field: ↓ enters at the top, ↑ at the bottom.
  assert.equal(nextOptionIndex('ArrowDown', -1, 3), 0);
  assert.equal(nextOptionIndex('ArrowUp', -1, 3), 2);
  assert.equal(nextOptionIndex('Enter', 0, 3), null);
  assert.equal(nextOptionIndex('ArrowDown', -1, 0), null);
});

test('choice lists: the keys work in the phone sheet and in the menu, the search field keeps its caret', () => {
  assert.equal((sheet.match(/onKeyDown=\{onListKeyDown\}/g) || []).length, 2);
  assert.equal((sheet.match(/<div ref=\{listRef\} role=/g) || []).length, 2);
  assert.match(sheet, /if \(target\.tagName === 'INPUT' && e\.key !== 'ArrowDown'\) return;/);
  assert.match(sheet, /if \(!listbox \|\| !listRef\.current\) return;/); // not in the Filtrer form
});
