import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { depositStepFields, depositMissingConditional, DEPOSIT_FIELD_LABELS, photosStillUploading } from './depositRules';
import { listingSchema } from '../types/listing';

const ACCESSORY_EXTRA: Record<string, string[]> = {
  Casque: ['helmetType', 'visorType'],
  Gant: ['size'],
  Veste: ['size', 'gender'],
  Pantalons: ['size', 'gender'],
  Chaussures: ['gender', 'shoeSize'],
  Antivol: ['antiTheftType'],
  Intercom: ['intercomFeatures'],
  Autre: [],
};

test('required fields per step: same lists as before the rules moved', () => {
  assert.deepEqual(depositStepFields('photos', {}), ['images']);
  assert.deepEqual(depositStepFields('technical', {}), ['category']);
  for (const category of ['Moto', 'Scooter', 'Quad']) {
    assert.deepEqual(depositStepFields('technical', { category }), ['brand', 'model', 'condition', 'year', 'mileage', 'cc']);
  }
  for (const [accessoryType, extra] of Object.entries(ACCESSORY_EXTRA)) {
    assert.deepEqual(
      depositStepFields('technical', { category: 'Accessoires', accessoryType }),
      ['brand', 'model', 'condition', 'accessoryType', ...extra],
      accessoryType,
    );
  }
  assert.deepEqual(depositStepFields('details', { category: 'Moto' }), ['price', 'governorate', 'phone', 'description']);
  assert.deepEqual(depositStepFields('equipment', { category: 'Moto' }), []);
  assert.deepEqual(depositStepFields('recap', { category: 'Moto' }), []);
});

test('every required field has a name for the toasts, description included', () => {
  for (const step of ['photos', 'technical', 'details'] as const) {
    for (const v of [{}, { category: 'Moto' }, ...Object.keys(ACCESSORY_EXTRA).map((accessoryType) => ({ category: 'Accessoires', accessoryType }))]) {
      for (const f of depositStepFields(step, v)) assert.ok(DEPOSIT_FIELD_LABELS[f], f);
    }
  }
  assert.equal(DEPOSIT_FIELD_LABELS.description, 'Description');
});

const base = { brand: 'Yamaha', model: 'NMAX', condition: 'Occasion', price: '9000', governorate: 'Tunis', phone: '22 123 456', description: 'Très bon état, entretien suivi chez le concessionnaire.', images: ['/uploads/a.webp'] };
const messages = (data: object) => {
  const r = listingSchema.safeParse(data);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]));
};

test('the schema reports the same conditional fields, with the same messages', () => {
  assert.deepEqual(messages({ ...base, category: 'Moto' }), { year: 'Année requise (4 chiffres)', mileage: 'Kilométrage requis', cc: 'Cylindrée requise' });
  assert.deepEqual(messages({ ...base, category: 'Moto', year: '26', mileage: '1000', cc: '125' }), { year: 'Année requise (4 chiffres)' });
  assert.deepEqual(messages({ ...base, category: 'Moto', year: '2024', mileage: '1000', cc: '125' }), {});
  assert.deepEqual(messages({ ...base, category: 'Accessoires' }), { accessoryType: "Type d'accessoire requis" });
  assert.deepEqual(messages({ ...base, category: 'Accessoires', accessoryType: 'Casque' }), { helmetType: 'Type de casque requis', visorType: 'Type de visière requis' });
  assert.deepEqual(messages({ ...base, category: 'Accessoires', accessoryType: 'Casque', helmetType: 'Intégral', visorType: ['a', 'b', 'c'] }), { visorType: 'Maximum 2 types de visière' });
  assert.deepEqual(messages({ ...base, category: 'Accessoires', accessoryType: 'Chaussures' }), { gender: 'Genre requis', shoeSize: 'Pointure requise' });
  assert.deepEqual(messages({ ...base, category: 'Accessoires', accessoryType: 'Intercom', intercomFeatures: [] }), { intercomFeatures: 'Sélectionner au moins une option' });
  assert.deepEqual(messages({ ...base, category: 'Accessoires', accessoryType: 'Antivol', antiTheftType: 'U' }), {});
  // The conditional list the schema uses is the rules' own.
  assert.deepEqual(depositMissingConditional({ category: 'Accessoires', accessoryType: 'Gant' }).map((m) => m.path), ['size']);
});

test('« Suivant » and « Publier » wait for photos through one check', () => {
  assert.equal(photosStillUploading([{ status: 'success' }, { status: 'uploading' }]), true);
  assert.equal(photosStillUploading([{ status: 'success' }, { status: 'error' }]), false);
  const page = readFileSync(new URL('../components/DepositAd.tsx', import.meta.url), 'utf8');
  assert.equal((page.match(/photosStillUploading\(mediaList\)/g) || []).length, 2);
  assert.doesNotMatch(page, /status === 'uploading'/);
  assert.doesNotMatch(page, /accessoryType === 'Casque'\) f\.push/);
});
