import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { depositSteps, depositStepAt, depositStepNumber, depositStepLabel, MAX_DEPOSIT_STEPS } from './depositSteps.ts';

test('the deposit starts with the photos, then the category', () => {
  assert.deepEqual(depositSteps(false), ['photos', 'category', 'technical', 'equipment', 'publish', 'location']);
  assert.deepEqual(depositSteps(true), ['photos', 'category', 'technical', 'publish', 'location']);
  assert.equal(MAX_DEPOSIT_STEPS, 6);
});

test('step numbers and ids map both ways, clamped to the last step', () => {
  assert.equal(depositStepAt(1, false), 'photos');
  assert.equal(depositStepAt(4, false), 'equipment');
  assert.equal(depositStepAt(4, true), 'publish');
  assert.equal(depositStepAt(6, true), 'location');
  assert.equal(depositStepAt(0, true), 'photos');
  // Choosing the category always moves on to the technical step (3).
  assert.equal(depositStepNumber('category', false) + 1, 3);
  assert.equal(depositStepNumber('category', true) + 1, 3);
  assert.equal(depositStepLabel('technical', true), 'Spécifications accessoire');
});

test('the wizard renders and validates by step id, not by hard-coded numbers', () => {
  const src = readFileSync(new URL('../components/DepositAd.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /step === [2-6]/);
  assert.doesNotMatch(src, /\? 5 : 6/);
  assert.doesNotMatch(src, /setStep\(2\)/);
  for (const id of ['photos', 'category', 'technical', 'equipment', 'publish', 'location']) {
    assert.match(src, new RegExp(`stepId === '${id}'`), id);
  }
  assert.match(src, /case 'photos':\s*return \['images'\];/);
});
