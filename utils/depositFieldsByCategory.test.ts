import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listingSchema } from '../types/listing';
import { depositFieldBelongs, keepDepositFields, strayDepositFields } from './depositRules';

// A helmet could be published with the year, km and cc of a moto (2026-11-13).
const deposit = readFileSync(new URL('../hooks/useDepositSession.ts', import.meta.url), 'utf8'); // the form's field relationships
const service = readFileSync(new URL('../services/listingService.ts', import.meta.url), 'utf8');

const MOTO = { category: 'Moto', brand: 'Yamaha', model: 'MT-07', year: '2019', mileage: '12000', cc: '700', equipment: ['ABS'], condition: 'Bon' };

test('a moto turned into a helmet loses the year, km, cc and equipment; brand, model, condition stay', () => {
  const helmet = { ...MOTO, category: 'Accessoires', accessoryType: 'Casque', helmetType: 'Jet' };
  assert.deepEqual(strayDepositFields(helmet).sort(), ['cc', 'equipment', 'mileage', 'year']);
  const kept = keepDepositFields(helmet);
  assert.equal(kept.year, '');
  assert.equal(kept.mileage, '');
  assert.equal(kept.cc, '');
  assert.deepEqual(kept.equipment, []);
  assert.equal(kept.brand, 'Yamaha');
  assert.equal(kept.helmetType, 'Jet');
});

test('a helmet turned into a moto loses the helmet fields', () => {
  const v = { category: 'Moto', accessoryType: 'Casque', helmetType: 'Jet', visorType: ['Fumée'], year: '2020' };
  assert.deepEqual(strayDepositFields(v).sort(), ['accessoryType', 'helmetType', 'visorType']);
});

test('between accessory types, only what no longer applies goes (« Veste » → « Pantalons » keeps size and gender)', () => {
  const v = { category: 'Accessoires', accessoryType: 'Pantalons', size: 'L', gender: 'Homme', helmetType: 'Jet' };
  assert.deepEqual(strayDepositFields(v), ['helmetType']);
  assert.equal(depositFieldBelongs('size', v), true);
  assert.equal(depositFieldBelongs('shoeSize', v), false);
});

test('moto ↔ scooter ↔ quad keep everything; fields of every listing always belong', () => {
  assert.deepEqual(strayDepositFields({ ...MOTO, category: 'Scooter' }), []);
  for (const f of ['brand', 'model', 'condition', 'price', 'description', 'images', 'phone']) {
    assert.equal(depositFieldBelongs(f, { category: 'Accessoires' }), true, f);
  }
});

test('a hidden field never blocks the publish; a visible one still does', () => {
  const base = {
    brand: 'Shoei', model: 'GT-Air 3', condition: 'Bon', price: '900', governorate: 'Tunis', phone: '+216 20 123 456',
    description: 'Casque très peu porté, taille M, avec sa housse.', images: ['/uploads/a.webp'],
  };
  const helmet = listingSchema.safeParse({ ...base, category: 'Accessoires', accessoryType: 'Casque', helmetType: 'Jet', visorType: ['Fumée'], mileage: '-1500', cc: '9999' });
  assert.equal(helmet.success, true, JSON.stringify(!helmet.success && helmet.error.issues));
  const moto = listingSchema.safeParse({ ...base, category: 'Moto', year: '2019', mileage: '-1500', cc: '125' });
  assert.ok(!moto.success && moto.error.issues.some((i) => i.path[0] === 'mileage'));
});

test('the form clears stray fields on a category or type change; the publish sends only kept fields', () => {
  assert.match(deposit, /if \(name === 'category' \|\| name === 'accessoryType'\) \{\n\s+for \(const field of strayDepositFields\(value as DepositValues\)\)/);
  assert.doesNotMatch(deposit, /setValue\('helmetType', ''\);/); // no hand-kept list any more
  assert.match(service, /const data = keepDepositFields\(input\);/);
});
