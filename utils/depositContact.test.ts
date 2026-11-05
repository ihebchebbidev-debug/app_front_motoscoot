import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the contact mode is one exclusive choice (radio buttons), not a switch plus two buttons', () => {
  const src = readFileSync(new URL('../components/deposit/StepPublish.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /role="switch"/);
  assert.match(src, /<fieldset[^>]*>\s*<legend/);
  assert.match(src, /type="radio"\s+name="contactMethod"/);
  assert.match(src, /min-h-11/);
  for (const t of ['Afficher mon numéro', 'Garder mon numéro privé']) assert.match(src, new RegExp(t));
});
