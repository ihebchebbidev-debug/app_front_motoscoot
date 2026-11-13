import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONDITION_HINTS, DEFAULT_CONDITIONS } from './depositOptions';

// Lot B (2026-11-13): short lists shown whole, the condition explained.
const step = readFileSync(new URL('../components/deposit/StepTechnical.tsx', import.meta.url), 'utf8');
const chips = readFileSync(new URL('../components/ui/ChoiceChips.tsx', import.meta.url), 'utf8');

test('short lists are chips, not drop-downs; only category, year and cylinder size stay lists', () => {
  assert.equal((step.match(/<Select\b/g) || []).length, 3);
  for (const f of ['accessoryType', 'helmetType', 'size', 'gender', 'antiTheftType', 'condition']) {
    assert.match(step, new RegExp(`name="${f}"\\n\\s+render=\\{\\(\\{ field \\}\\) => \\(\\n\\s+<ChoiceChips`), f);
  }
});

test('chips are real radio buttons in a named group, 44 px tall, the error focuses the group', () => {
  assert.match(chips, /<fieldset/);
  assert.match(chips, /<legend className=\{`\$\{type\.label\} ml-1 mb-2`\}>\{label\}<\/legend>/);
  assert.match(chips, /type="radio"/);
  assert.match(chips, /className="sr-only"/);
  assert.match(chips, /min-h-\[44px\]/);
  assert.match(chips, /ref=\{i === 0 \? ref : undefined\}/);
  assert.match(chips, /has-\[:focus-visible\]:outline/);
});

test('every condition has the explanation the owner validated', () => {
  for (const c of DEFAULT_CONDITIONS) assert.ok(CONDITION_HINTS[c], c);
  assert.equal(CONDITION_HINTS['État neuf'], "Très peu utilisé (moins de 1 000 km), aucune trace d'usure.");
  assert.match(step, /variant="cards"[\s\S]*hint: CONDITION_HINTS\[value\]/);
});

test('the condition comes last, once the item is described, across the full width', () => {
  assert.ok(step.indexOf('name="condition"') > step.indexOf("label=\"Cylindrée\""));
  assert.match(step, /variant="cards"\n\s+className="md:col-span-2"/);
});
