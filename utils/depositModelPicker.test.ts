import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanModelName } from '../components/deposit/ModelPicker';

// Lot D (2026-11-13): « Modèle » works like « Marque ».
const step = readFileSync(new URL('../components/deposit/StepTechnical.tsx', import.meta.url), 'utf8');
const model = readFileSync(new URL('../components/deposit/ModelPicker.tsx', import.meta.url), 'utf8');
const catalog = readFileSync(new URL('../components/deposit/CatalogPicker.tsx', import.meta.url), 'utf8');
const picker = model + catalog;
const brand = readFileSync(new URL('../components/deposit/BrandPicker.tsx', import.meta.url), 'utf8');

test('the model opens the same sheet as the brand, with every model of the brand at once', () => {
  assert.match(step, /name="model"\n\s+render=\{\(\{ field \}\) => \(\n\s+<ModelPicker/);
  assert.match(picker, /<ChoiceSheet/);
  assert.match(picker, /anchor=\{wrapRef\}/);
  assert.match(picker, /\n\s+tall\n/);
  assert.match(model, /sheetTitle=\{brand \? `Modèles \$\{brand\}` : label\}/);
  assert.match(model, /search: 'Rechercher un modèle…'/);
  assert.match(picker, /matchBrands\(names, query\)/); // all models when nothing is typed
});

test('both pickers are the one catalogue picker (rows, highlight, outside click, free text)', () => {
  for (const src of [model, brand]) assert.match(src, /<CatalogPicker/);
  assert.match(catalog, /from '\.\/pickerParts'/);
});

test('no brand yet: the field waits for it and nothing is downloaded', () => {
  assert.match(picker, /Choisissez d’abord la marque/);
  assert.match(catalog, /disabled=\{!!waiting\}/);
  assert.match(step, /useModelsByBrand\(brand \|\| undefined, accessoryTypeForModels, !!brand\)/);
});

test('a model missing from the list can be typed, tidied, 100 characters at most', () => {
  assert.match(picker, /Mon modèle n’est pas dans la liste/);
  assert.match(model, /use: \(typed\) => `Utiliser « \$\{typed\} » comme modèle`/);
  assert.match(model, /freeTextOnly=\{!!brand && !loading && names\.length === 0\}/);
  assert.equal(cleanModelName('  TMAX   560 '), 'TMAX 560');
  assert.equal(cleanModelName('x'.repeat(120)).length, 100);
});

test('the behaviour lives once: neither picker has its own sheet, free text or Enter', () => {
  assert.doesNotMatch(model + brand, /<ChoiceSheet|setManual|typeByHand|onEnter|useCloseOutside/);
  for (const piece of ['<ChoiceSheet', 'setManual', 'typeByHand', 'onEnter', 'useCloseOutside']) assert.ok(catalog.includes(piece), piece);
});
