import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { modelExample } from './depositOptions';

// Step 2/5 dropdown review (lot A, 2026-11-13).
const step = readFileSync(new URL('../components/deposit/StepTechnical.tsx', import.meta.url), 'utf8');
const select = readFileSync(new URL('../components/ui/Select.tsx', import.meta.url), 'utf8');

test('an empty list reads as empty: grey placeholder, as the inputs and the brand picker', () => {
  assert.match(select, /\[&:has\(option\[value=''\]:checked\)\]:text-gray-500/);
  assert.match(select, /\[&_option\]:text-gray-900/); // the opened list stays dark
});

test('one wording for an empty list: « Choisir … »', () => {
  assert.doesNotMatch(step, /Sélectionner/);
  for (const p of ["Choisir une catégorie", "Choisir un type", "Choisir l'état", "Choisir l'année", 'Choisir la cylindrée', 'Choisir une taille']) {
    assert.ok(step.includes(p), p);
  }
});

test('French spelling of the stored choices', () => {
  assert.match(step, /"Fumée", "Claire", "Iridium"/);
  assert.match(step, /"Bloque-disque", "Bloque-guidon", "Chaîne", "Antivol en U"/);
  assert.match(step, /<option value="Électrique">Électrique<\/option>\n\s+<option value="Autre">Autre<\/option>/);
});

test('the model example fits what is sold', () => {
  assert.equal(modelExample('Scooter'), 'Ex : TMAX 560');
  assert.equal(modelExample('Accessoires', 'Casque'), 'Ex : Shoei GT-Air 3');
  assert.equal(modelExample('Accessoires'), 'Ex : le nom du modèle');
  assert.match(step, /placeholder=\{modelExample\(category, accessoryType\)\}/);
});

test('no decorative icons; the mileage says its unit', () => {
  assert.doesNotMatch(step, /Layers|Gauge/);
  assert.match(step, />km<\/span>/);
});

test('choice groups: a legend in the labels’ style, no capitals typed by hand, 44 px targets', () => {
  assert.doesNotMatch(step, /TYPE DE VISIÈRE|FONCTIONNALITÉS INTERCOM/);
  assert.match(step, /<legend className=\{`\$\{fieldType\.label\} ml-1 mb-2`\}>Type de visière<\/legend>/);
  assert.match(step, /<legend className=\{`\$\{fieldType\.label\} ml-1 mb-2`\}>Options Intercom<\/legend>/);
  assert.match(step, /const CHECK_ROW = "min-h-\[44px\]/);
});
