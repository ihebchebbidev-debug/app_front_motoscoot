import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the description template does not speak for the seller on price or tone', () => {
  const src = readFileSync(new URL('../components/deposit/StepPublish.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /Curieux s'abstenir/);
  assert.doesNotMatch(src, /Prix légèrement négociable/);
});
