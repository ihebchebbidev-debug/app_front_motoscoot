import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Phone panels of the shared filter bar (fiches-techniques brand page, news,
// tips): they are the home search bar's sheet, so they follow the finger,
// close with a flick down, a tap on the scrim or Escape, and leave the way
// they came in. The old panels did none of that and vanished at once.
const bar = readFileSync(new URL('../components/ui/FilterBar.tsx', import.meta.url), 'utf8');
const sheet = readFileSync(new URL('../components/search/ChoiceSheet.tsx', import.meta.url), 'utf8');
const models = readFileSync(new URL('../components/TechSpecsModels.tsx', import.meta.url), 'utf8');

test('both phone panels are the draggable sheet, not fixed overlays', () => {
  assert.match(bar, /import \{ ChoiceSheet \} from '\.\.\/search\/ChoiceSheet';/);
  assert.match(bar, /<ChoiceSheet open=\{isSortSheetOpen\} label="Trier par"/);
  assert.match(bar, /<ChoiceSheet\s+open=\{isSortMenuOpen\}/);
  assert.doesNotMatch(bar, /fixed inset-0 z-\[150\]/);
  assert.doesNotMatch(bar, /document\.body\.style\.overflow/); // the sheet locks the page (iPhone too)
});

test('the filters panel is named for what it holds', () => {
  assert.match(bar, /label=\{showSort && onSortChange \? 'Trier et filtrer' : 'Filtrer'\}/);
  assert.doesNotMatch(bar, />Trier et Filtrer<|'Trier et Filtrer'/);
  // Sentence-case dark section titles, no light-grey heavy capitals (3:1).
  assert.match(bar, /const SECTION = 'text-\[15px\] font-semibold text-gray-900 mb-3';/);
  assert.doesNotMatch(bar, /text-gray-400 uppercase tracking-widest/);
  // « Voir 9 modèles » in sentence case, pinned under the list.
  assert.match(bar, /w-full min-h-12 bg-gray-900 text-white text-\[16px\] font-semibold rounded-2xl/);
});

test('the search inside the panel does not zoom the page on iPhone', () => {
  assert.doesNotMatch(bar, /rounded-2xl text-sm font-bold text-gray-900/);
  assert.equal((bar.match(/text-\[16px\] font-medium text-gray-900/g) || []).length, 2);
});

test('the sheet can hold a form, a header action and a footer', () => {
  assert.match(sheet, /listbox = true, headerAction, footer, children/);
  assert.match(sheet, /role=\{listbox \? 'listbox' : undefined\}/);
  assert.match(sheet, /\{footer\}/);
  // 44 px close button, with no taller header row.
  assert.match(sheet, /-my-2\.5 -mr-2\.5/);
  assert.match(sheet, /className="w-11 h-11 flex items-center justify-center rounded-full/);
});

test('brand page: the model search is on the page, not behind « Filtres »', () => {
  assert.match(models, /searchPlaceholder="Rechercher un modèle…"\s+phoneSearch/);
  assert.match(bar, /\{!phoneSearch && \(\s*<div>\s*<h4 className=\{SECTION\}>Recherche<\/h4>/);
});
