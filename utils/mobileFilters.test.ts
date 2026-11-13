import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resultsButtonLabel } from './mobileFilters';

// 2026-11-13, owner: « faire la même chose sur le bouton Filtres » (phones),
// « ne touche pas les filtres desktop ».

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('the results button speaks French plurals', () => {
  assert.equal(resultsButtonLabel(0), 'Aucune annonce');
  assert.equal(resultsButtonLabel(1), 'Voir 1 annonce');
  assert.equal(resultsButtonLabel(8), 'Voir 8 annonces');
});

test('phone filters live in the shared sheet (Escape, focus, drag to close)', () => {
  const src = read('../components/search/MobileFilters.tsx');
  assert.match(src, /<ChoiceSheet[^>]*label="Filtres"/);
  assert.match(src, /returnFocus=\{returnFocus\}/);
  assert.doesNotMatch(src, /fixed inset-0/, 'no hand-made full-screen layer any more');
  assert.doesNotMatch(src, /body\.style\.overflow/, 'the sheet locks the page itself');
});

test('« Autour de moi » no longer closes the filters before the position comes back', () => {
  const src = read('../components/search/MobileFilters.tsx');
  assert.match(src, /onClick=\{onLocationDetect\}/);
  assert.doesNotMatch(src, /onLocationDetect\(\);\s*if/);
});

test('buyers’ filters come first: search, type, brand, model, budget, governorate', () => {
  const src = read('../components/search/MobileFilters.tsx');
  const order = ['id="mf-search"', "key: 'type'", "key: 'brand'", "key: 'model'", 'label="Budget (DT)"', 'renderSelect(govSelect)', 'Plus de filtres'];
  const body = src.slice(src.indexOf('return (\n    <ChoiceSheet'));
  const head = src;
  const pos = order.map((o) => (o.startsWith('key:') ? head.indexOf(o) : body.indexOf(o)));
  pos.forEach((p, i) => assert.ok(p >= 0, `${order[i]} is present`));
  assert.ok(body.indexOf('id="mf-search"') < body.indexOf('selects.map(renderSelect)'));
  assert.ok(body.indexOf('selects.map(renderSelect)') < body.indexOf('label="Budget (DT)"'));
  assert.ok(body.indexOf('label="Budget (DT)"') < body.indexOf('renderSelect(govSelect)'));
  assert.ok(body.indexOf('renderSelect(govSelect)') < body.indexOf('Plus de filtres'));
});

test('desktop keeps its filter sidebar', () => {
  const page = read('../components/SearchResults.tsx');
  assert.match(page, /<FilterSidebar /);
});
