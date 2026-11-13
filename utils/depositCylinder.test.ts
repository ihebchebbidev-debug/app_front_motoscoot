import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listingSchema } from '../types/listing';
import { CC_CUSTOM, ccIsValid, cleanCc, isListedCc } from './depositOptions';

// 2026-11-13: « Cylindrée » can also be typed (owner request).
const field = readFileSync(new URL('../components/deposit/CylinderField.tsx', import.meta.url), 'utf8');
const step = readFileSync(new URL('../components/deposit/StepTechnical.tsx', import.meta.url), 'utf8');
const recap = readFileSync(new URL('../components/deposit/StepRecap.tsx', import.meta.url), 'utf8');

const BASE = {
  category: 'Moto', brand: 'Triumph', model: 'Rocket 3', condition: 'Bon', year: '2021', mileage: '12000', cc: '125',
  price: '60000', governorate: 'Tunis', phone: '+216 20 123 456', description: 'Très bon état, entretien suivi chez le concessionnaire.',
  images: ['/uploads/a.webp'],
};
const ccIssue = (cc: string) => {
  const r = listingSchema.safeParse({ ...BASE, cc });
  return !r.success && r.error.issues.some((i) => i.path[0] === 'cc');
};

test('the list keeps its sizes, Électrique and Autre, and adds « Autre cylindrée (saisir) »', () => {
  assert.match(field, /<option value=\{CC_CUSTOM\}>Autre cylindrée \(saisir\)<\/option>/);
  assert.ok(isListedCc('125') && isListedCc('Électrique') && isListedCc('Autre'));
  assert.equal(isListedCc('1250'), false);
});

test('choosing it opens a number field in cc, with a way back to the list', () => {
  assert.match(field, /if \(e\.target\.value === CC_CUSTOM\) \{ setTyping\(true\); onChange\(''\); return; \}/);
  assert.match(field, /inputMode="numeric"/);
  assert.match(field, />cc<\/span>/);
  assert.match(field, /Choisir dans la liste/);
  assert.match(step, /name="cc"\n\s+render=\{\(\{ field \}\) => \(\n\s+<CylinderField/);
});

test('a typed size is digits only, 30 to 3 000 cc; the marker is never accepted', () => {
  assert.equal(cleanCc('01 250'), '1250');
  for (const ok of ['49', '1250', '2458', '3000', '125', 'Électrique', 'Autre', '']) assert.ok(ccIsValid(ok), ok);
  for (const bad of ['5', '3001', '12.5', 'abc', CC_CUSTOM]) assert.equal(ccIsValid(bad), false, bad);
  assert.equal(ccIssue('2458'), false);
  assert.equal(ccIssue('9999'), true);
});

test('the recap shows a typed size in cc and the words as written', () => {
  assert.match(recap, /v\.cc === 'Autre' \|\| v\.cc === 'Électrique' \? v\.cc : formatNumber\(v\.cc, 'cc'\)/);
});
