import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listingSchema } from '../types/listing';
import { draftOverEmpty, emptyDepositValues } from './depositValues';

// « Réinitialiser » did not clear everything (owner, 2026-11-13).
const deposit = readFileSync(new URL('../components/DepositAd.tsx', import.meta.url), 'utf8');
const draft = readFileSync(new URL('../hooks/useAdDraft.ts', import.meta.url), 'utf8');
const media = readFileSync(new URL('../hooks/useMediaUpload.ts', import.meta.url), 'utf8');

const schemaKeys = () => {
  // listingSchema is an object wrapped in superRefine (ZodEffects).
  const inner = (listingSchema as any)._def.schema ?? listingSchema;
  return Object.keys(inner.shape).sort();
};

test('the empty form holds every field of the schema, nothing more', () => {
  assert.deepEqual(Object.keys(emptyDepositValues()).sort(), schemaKeys());
});

test('the empty form is a new object each time (a reset never shares arrays with the last listing)', () => {
  const a = emptyDepositValues();
  const b = emptyDepositValues();
  assert.notEqual(a.images, b.images);
  assert.notEqual(a.visorType, b.visorType);
});

test('a draft restores on top of the empty form', () => {
  const v = draftOverEmpty({ brand: 'Yamaha', model: 'MT-07' });
  assert.equal(v.brand, 'Yamaha');
  assert.equal(v.shoeSize, '');
  assert.deepEqual(draftOverEmpty(null), emptyDepositValues());
});

test('the draft restore keeps the empty defaults; a reset passes the empty values', () => {
  // reset(values) makes `values` the new defaults in react-hook-form: the draft
  // became the defaults and a bare reset() brought it back.
  assert.match(draft, /resetForm\(draftOverEmpty\(savedValues\), \{ keepDefaultValues: true \}\)/);
  assert.match(deposit, /defaultValues: emptyDepositValues\(\),/);
  assert.match(deposit, /reset\(emptyDepositValues\(\)\);/);
  assert.doesNotMatch(deposit, /\breset\(\);/);
});

test('a reset also empties the photos (previews freed), the market price, and remounts the step', () => {
  assert.match(deposit, /clearMedia\(\);/);
  assert.match(media, /URL\.revokeObjectURL\(m\.url\)/);
  assert.match(deposit, /setPriceEstimate\(null\);\n\s+setStep\(1\);/);
  assert.match(deposit, /if \(estimateCtrlRef\.current\) estimateCtrlRef\.current\.abort\(\);\n\s+setPriceEstimate\(null\);/);
  assert.match(deposit, /key=\{`\$\{depositRun\}-\$\{step\}`\}/);
  assert.match(deposit, /setDepositRun\(\(n\) => n \+ 1\);/);
});

test('« Déposer une autre annonce » and « Réinitialiser » start the same blank deposit', () => {
  assert.match(deposit, /const handleDepositAnother = \(\) => \{\n\s+startBlankDeposit\(\);/);
  assert.match(deposit, /if \(!window\.confirm\([^)]*\)\) return;\n\s+startBlankDeposit\(\);/);
});
