import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanModelName } from '../components/deposit/ModelPicker';

// Lot D (2026-11-13): « Modèle » works like « Marque ».
const step = readFileSync(new URL('../components/deposit/StepTechnical.tsx', import.meta.url), 'utf8');
const picker = readFileSync(new URL('../components/deposit/ModelPicker.tsx', import.meta.url), 'utf8');
const brand = readFileSync(new URL('../components/deposit/BrandPicker.tsx', import.meta.url), 'utf8');

test('the model opens the same sheet as the brand, with every model of the brand at once', () => {
  assert.match(step, /name="model"\n\s+render=\{\(\{ field \}\) => \(\n\s+<ModelPicker/);
  assert.match(picker, /<ChoiceSheet/);
  assert.match(picker, /anchor=\{wrapRef\}/);
  assert.match(picker, /\n\s+tall\n/);
  assert.match(picker, /label=\{brand \? `Modèles \$\{brand\}` : label\}/);
  assert.match(picker, /placeholder: 'Rechercher un modèle…'/);
  assert.match(picker, /matchBrands\(names, query\)/); // all models when nothing is typed
});

test('both pickers share their rows, highlight and outside click', () => {
  for (const src of [picker, brand]) assert.match(src, /from '\.\/pickerParts'/);
});

test('no brand yet: the field waits for it and nothing is downloaded', () => {
  assert.match(picker, /Choisissez d’abord la marque/);
  assert.match(picker, /disabled=\{waiting\}/);
  assert.match(step, /useModelsByBrand\(brand \|\| undefined, accessoryTypeForModels, !!brand\)/);
});

test('a model missing from the list can be typed, tidied, 100 characters at most', () => {
  assert.match(picker, /Mon modèle n’est pas dans la liste/);
  assert.match(picker, /Utiliser « \{cleanModelName\(query\)\} » comme modèle/);
  assert.match(picker, /noCatalogue = !!brand && !loading && names\.length === 0/);
  assert.equal(cleanModelName('  TMAX   560 '), 'TMAX 560');
  assert.equal(cleanModelName('x'.repeat(120)).length, 100);
});
