import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { depositSteps, depositStepAt, depositStepNumber, depositStepLabel, MAX_DEPOSIT_STEPS, DEPOSIT_CATEGORIES } from './depositSteps.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('photos first, category inside the technical step, recap last, no location step', () => {
  assert.deepEqual(depositSteps(false), ['photos', 'technical', 'equipment', 'details', 'recap']);
  assert.deepEqual(depositSteps(true), ['photos', 'technical', 'details', 'recap']);
  assert.equal(MAX_DEPOSIT_STEPS, 5);
});

test('step numbers and ids map both ways, clamped to the last step', () => {
  assert.equal(depositStepAt(1, false), 'photos');
  assert.equal(depositStepAt(3, false), 'equipment');
  assert.equal(depositStepAt(3, true), 'details');
  assert.equal(depositStepAt(9, true), 'recap');
  assert.equal(depositStepAt(0, true), 'photos');
  assert.equal(depositStepNumber('equipment', true), 0);
  assert.equal(depositStepNumber('recap', false), 5);
  assert.equal(depositStepLabel('details', false), 'Prix et description');
});

test('the category tiles offer exactly the categories the form accepts', () => {
  const schema = read('types/listing.ts');
  for (const c of DEPOSIT_CATEGORIES) assert.match(schema, new RegExp(`'${c}'`));
  const tech = read('components/deposit/StepTechnical.tsx');
  assert.match(tech, /const allowed = new Set<string>\(DEPOSIT_CATEGORIES\);/);
  assert.match(tech, /options=\{categoryOptions\.map\(\(value\) => \(\{ value, image: categoryTileImage/);
});

test('the wizard renders and validates by step id, without the old category and map steps', () => {
  const src = read('components/DepositAd.tsx');
  assert.doesNotMatch(src, /step === [2-6]/);
  assert.doesNotMatch(src, /StepCategory|StepLocation/);
  for (const id of ['photos', 'technical', 'equipment', 'details', 'recap']) {
    assert.match(src, new RegExp(`stepId === '${id}'`), id);
  }
  // Required fields by step id (utils/depositRules.ts, tested in depositRules.test.ts).
  assert.match(src, /depositStepFields\(depositStepAt\(targetStep, isAccessory\), allValues\)/);
  // The profile position keeps new listings in the proximity search.
  assert.match(src, /setValue\('latitude', user\.latitude/);
});
