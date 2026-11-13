import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brandKey, cleanBrandName, knownBrand, matchBrands, popularBrands, POPULAR_COUNT } from './brandPicker';

const picker = readFileSync(new URL('../components/deposit/BrandPicker.tsx', import.meta.url), 'utf8');
const step = readFileSync(new URL('../components/deposit/StepTechnical.tsx', import.meta.url), 'utf8');
const sheet = readFileSync(new URL('../components/search/ChoiceSheet.tsx', import.meta.url), 'utf8');

const NAMES = ['Yamaha', 'SYM', 'Royal-Enfield', 'Peugeot', 'Kymco', 'Honda', 'KTM', 'Benelli', 'Zontes', 'Voge', 'CFMoto', 'Piaggio', 'Teyin'];

test('the search forgives case, accents, spaces and hyphens', () => {
  assert.equal(brandKey('Royal-Enfield'), brandKey('royal enfield'));
  assert.equal(brandKey('Peugéot'), 'peugeot');
  assert.deepEqual(matchBrands(NAMES, 'royal en'), ['Royal-Enfield']);
  assert.deepEqual(matchBrands(NAMES, 'YAM'), ['Yamaha']);
});

test('names that start with the letters come before names that only contain them', () => {
  // « mo »: no brand starts with it; CFMoto contains it.
  assert.deepEqual(matchBrands(NAMES, 'mo'), ['CFMoto']);
  // « k »: KTM and Kymco start with it (A → Z), then Suzuki that contains it.
  assert.deepEqual(matchBrands(['Kymco', 'KTM', 'Teyin', 'Suzuki'], 'k'), ['KTM', 'Kymco', 'Suzuki']);
});

test('no query: every brand, A → Z', () => {
  const all = matchBrands(NAMES, '');
  assert.equal(all.length, NAMES.length);
  assert.equal(all[0], 'Benelli');
  assert.equal(all[all.length - 1], 'Zontes');
});

test('popular: the most listings in the category first, never a brand without one, eight at most', () => {
  const counts = new Map([['sym', 40], ['yamaha', 25], ['peugeot', 25], ['kymco', 3], ['ktm', 0]]);
  assert.deepEqual(popularBrands(NAMES, counts), ['SYM', 'Peugeot', 'Yamaha', 'Kymco']);
  const many = new Map(NAMES.map((n, i) => [n.toLowerCase(), i + 1]));
  assert.equal(popularBrands(NAMES, many).length, POPULAR_COUNT);
});

test('a short list shows no popular block: A → Z is enough', () => {
  assert.deepEqual(popularBrands(['SYM', 'Yamaha'], new Map([['sym', 9]])), []);
});

test('a typed known brand takes the catalogue spelling; a free name is tidied', () => {
  assert.equal(knownBrand(NAMES, 'royal enfield'), 'Royal-Enfield');
  assert.equal(knownBrand(NAMES, 'Inconnue'), undefined);
  assert.equal(cleanBrandName('  Mash   Motors '), 'Mash Motors');
  assert.equal(cleanBrandName('x'.repeat(60)).length, 40);
});

test('the form step uses the picker, not a long <select>', () => {
  assert.doesNotMatch(step, /<Select label="Marque"/);
  assert.match(step, /<BrandPicker/);
  assert.match(step, /name="brand"/);
});

test('the picker reuses the shared sheet: phone sheet, menu under the field from 768 px', () => {
  assert.match(picker, /<ChoiceSheet/);
  assert.match(picker, /anchor=\{wrapRef\}/);
  assert.match(picker, /placeholder: 'Rechercher une marque…'/);
  assert.match(sheet, /onEnter\?: \(\) => void/);
});

test('every choice is a 44 px target and a brand missing from the list can be typed', () => {
  assert.match(picker, /min-h-\[44px\]/);
  assert.match(picker, /Ma marque n’est pas dans la liste/);
  assert.match(picker, /Choisir dans la liste des marques/);
});

test('logos load lazily and are decorative (the name is the label)', () => {
  assert.match(picker, /loading="lazy"/);
  assert.match(picker, /alt=""/);
});
