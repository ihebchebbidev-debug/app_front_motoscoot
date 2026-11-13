import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const deposit = readFileSync('components/DepositAd.tsx', 'utf8');
const publish = readFileSync('components/deposit/StepPublish.tsx', 'utf8');

test('a field raised by "Suivant" is re-checked as soon as it changes', () => {
  assert.match(readFileSync('hooks/useDepositSession.ts', 'utf8'), /getFieldState\(field as any\)\.error\) void trigger\(field as any\)/);
});

test('steps get a fresh errors object, so a fixed field drops its message', () => {
  assert.match(deposit, /const stepErrors = \{ \.\.\.errors \};/);
  assert.doesNotMatch(deposit, /errors=\{errors\}/);
});

test('no toast repeating the messages already shown under the fields', () => {
  assert.match(deposit, /FIELDS_WITH_INLINE_ERROR/);
  assert.doesNotMatch(deposit, /Champs requis manquants : \$\{labels\.join/);
});

test('the description shows its 20-character minimum before it becomes an error', () => {
  assert.match(publish, /20 caractères minimum/);
  assert.match(publish, /aria-describedby="description-count"/);
});
