import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listingSchema, MILEAGE_PATTERN } from '../types/listing';
import { DEFAULT_CONDITIONS, optionsWithValue } from './depositOptions';
import { BRAND_LIST_LIMIT, tidyBrands } from './brandPicker';

// Worst cases found with dev/etape-2.html (break-ui, 2026-11-13).
const step = readFileSync(new URL('../components/deposit/StepTechnical.tsx', import.meta.url), 'utf8');
const picker = readFileSync(new URL('../components/deposit/BrandPicker.tsx', import.meta.url), 'utf8')
  + readFileSync(new URL('../components/deposit/CatalogPicker.tsx', import.meta.url), 'utf8');
const select = readFileSync(new URL('../components/ui/Select.tsx', import.meta.url), 'utf8');
const input = readFileSync(new URL('../components/ui/Input.tsx', import.meta.url), 'utf8');
const modelPicker = readFileSync(new URL('../components/deposit/ModelPicker.tsx', import.meta.url), 'utf8')
  + readFileSync(new URL('../components/deposit/CatalogPicker.tsx', import.meta.url), 'utf8');

const BASE = {
  category: 'Scooter', brand: 'Yamaha', model: 'TMAX 560', condition: 'Bon', year: '2019', mileage: '12000', cc: '560',
  price: '30000', governorate: 'Tunis', phone: '+216 20 123 456', description: 'Très bon état, entretien suivi chez le concessionnaire.',
  images: ['/uploads/a.webp'],
};
const issues = (patch: Record<string, unknown>) => {
  const r = listingSchema.safeParse({ ...BASE, ...patch });
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

test('mileage: a whole number of km from 0 to 999 999, nothing else', () => {
  for (const ok of ['0', '12000', '999999']) assert.ok(MILEAGE_PATTERN.test(ok), ok);
  for (const bad of ['-1500', '12.5', '1e6', '1000000', '12 000']) assert.ok(issues({ mileage: bad }).includes('mileage'), bad);
  assert.deepEqual(issues({ mileage: '12000' }), []);
});

test('model and brand: 100 characters at most, as the database columns', () => {
  assert.ok(issues({ model: 'x'.repeat(101) }).includes('model'));
  assert.ok(issues({ brand: 'x'.repeat(101) }).includes('brand'));
  assert.deepEqual(issues({ model: 'TMAX 560 Tech MAX ABS Édition spéciale 20e anniversaire – Icon Blue / Midnight Black' }), []);
  assert.match(modelPicker, /maxLength=\{100\}/);
  assert.match(modelPicker, /\.slice\(0, 100\)/);
});

test('a restored condition is shown even when the list arrives after it', () => {
  assert.deepEqual(optionsWithValue(['Neuf', 'Bon'], 'Bon'), ['Neuf', 'Bon']);
  assert.deepEqual(optionsWithValue([], 'Très bon'), ['Très bon']);
  assert.deepEqual(optionsWithValue(['Neuf'], ''), ['Neuf']);
  assert.match(step, /name="condition"[\s\S]*optionsWithValue\(conditionList, field\.value\)/);
  assert.match(step, /name="accessoryType"[\s\S]*optionsWithValue\(accessoryTypeNames, field\.value\)/);
});

test('an empty condition list does not lock the seller on step 2', () => {
  assert.ok(DEFAULT_CONDITIONS.length >= 5);
  assert.match(step, /conditionData\.length > 0 \? conditionData : DEFAULT_CONDITIONS/);
});

test('brands: one per name however cased, trimmed, the one with a logo kept', () => {
  const out = tidyBrands([
    { name: 'Sym', logo_url: null }, { name: 'SYM', logo_url: '/l.png' }, { name: '  Peugeot   Motocycles ' }, { name: '   ' },
    { name: 'Zhejiang Qianjiang Motorcycle Co., Ltd (QJ Motor)' },
  ]);
  assert.deepEqual(out.map((b) => b.name), ['SYM', 'Peugeot Motocycles', 'Zhejiang Qianjiang Motorcycle Co., Ltd (QJ Motor)']);
});

test('the picker: no broken logo, full names on hover, 200 rows at most', () => {
  assert.match(picker, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.equal((picker.match(/title=\{name\}/g) || []).length, 2);
  assert.equal(BRAND_LIST_LIMIT, 200);
  assert.match(picker, /matches\.slice\(0, BRAND_LIST_LIMIT\)/);
});

test('select text stops before the arrow; input labels name their field', () => {
  assert.match(select, /pl-5 pr-12 py-4/);
  assert.match(input, /<label htmlFor=\{id\}/);
  assert.doesNotMatch(step, /SuggestionList|showSuggestions/); // the old model menu is gone (lot D)
});
