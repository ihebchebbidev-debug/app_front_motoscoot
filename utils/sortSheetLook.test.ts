import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f: string) => readFileSync(new URL(`../components/${f}`, import.meta.url), 'utf8');
const row = read('search/SortOptionRow.tsx');
const bar = read('ui/FilterBar.tsx');
const annonces = read('search/PhoneSortSheet.tsx');

test('every phone sort panel uses the one row: round mark, orange chosen row', () => {
  assert.match(row, /checked \? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 bg-white'/);
  assert.match(row, /checked \? 'bg-primary-50' : ''/);
  assert.match(row, /role="option"\s+aria-selected=\{checked\}/);
  assert.match(bar, /<SortOptionRow\s+key=\{opt\.value\}/);
  assert.match(annonces, /<SortOptionRow\s+key=\{o\.value\}/);
  assert.doesNotMatch(bar, /justify-between gap-3 px-5 py-3 text-left text-\[16px\]/); // the old tick-on-the-right row
});

test('sort panels are titled for what they sort, like « Trier les annonces »', () => {
  assert.match(annonces, /label="Trier les annonces"/);
  assert.match(read('TechSpecsBrands.tsx'), /sortSheetTitle="Trier les marques"/);
  assert.match(read('TechSpecsModels.tsx'), /sortSheetTitle="Trier les modèles"/);
});
