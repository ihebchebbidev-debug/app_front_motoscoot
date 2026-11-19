import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sheet = readFileSync(new URL('../components/search/ChoiceSheet.tsx', import.meta.url), 'utf8');
const bar = readFileSync(new URL('../components/ui/FilterBar.tsx', import.meta.url), 'utf8');

test('filter panel: the new count is announced when a filter changes', () => {
  assert.match(bar, /const resultsAnnouncement = \/\^Voir\\s\/\.test\(applyLabel\) \? applyLabel\.replace\(\/\^Voir\\s\+\/, ''\) : '';/);
  assert.match(bar, /<p role="status" aria-live="polite" className="sr-only">\{resultsAnnouncement\}<\/p>/);
});

test('sheet: the panel is the dialog, named by its visible title', () => {
  assert.match(sheet, /ref=\{panelRef\}\s+role="dialog"\s+aria-modal="true"\s+aria-labelledby=\{titleId\}/);
  assert.match(sheet, /<h2 id=\{titleId\} className="text-base font-bold text-gray-900">\{label\}<\/h2>/);
  assert.doesNotMatch(sheet, /onClick=\{onClose\}\s+role="dialog"/); // not the scrim any more
});
