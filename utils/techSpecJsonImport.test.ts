import test from 'node:test';
import assert from 'node:assert/strict';
import { mapJsonToForm } from '../components/admin/TechSpecsJsonImport.tsx';

// "Import rapide via JSON" (admin › Fiches techniques › formulaire) must fill
// every field of the form: 37 spec fields + brand, model, year, category.
const fiche = {
  brand: 'BMW Motorrad', model: 'R 1300 GS', year: 2026, category: 'Trail',
  price_new: null, image: '', gallery: [], norm_logo: '',
  engine: { type: 'Boxer', cc: '1300 cc', power: '145 ch (107 kW)', torque: '149 Nm', fuelSystem: 'Injection', cooling: 'Air / liquide', transmission: '6 vitesses' },
  chassis: { frame: 'Acier', suspensionFront: 'Telelever', travelFront: '190 mm', suspensionRear: 'Paralever', travelRear: '200 mm', brakesFront: '2 disques 310 mm', brakesRear: 'Disque 285 mm', tireFront: '120/70 R19', tireRear: '170/60 R17' },
  electronics: {
    abs: 'Série', tcs: 'Série (DTC)', ridingModes: 'Eco / Rain / Road / Enduro', quickshifter: 'Optionnel',
    lighting: 'Full LED (série)', usb: 'Oui (série)', dashboard: 'TFT 6,5 pouces', connectivity: 'Bluetooth',
    cruiseControl: 'Série', keyless: 'Oui', other: 'Poignées chauffantes',
  },
  maintenance: { warranty: '2 ans', firstService: '1 000 km', serviceInterval: 'Tous les 10 000 km ou 1 an' },
  dimensions: { weight: '237 kg', seatHeight: '850 mm', tank: '19 L', length: '2212 mm', wheelbase: '1518 mm' },
  consumption: '4,8 L/100', top_speed: 'Plus de 200 km/h',
};

test('the quick JSON paste fills all 41 form fields, with no error', () => {
  const r = mapJsonToForm(fiche);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.appliedCount, 41);
});

test('the 10 fields added to the form are read (electronics, warranty, services)', () => {
  const p = mapJsonToForm(fiche).partial;
  assert.deepEqual(
    [p.lighting, p.usb, p.dashboard, p.connectivity, p.cruise_control, p.keyless, p.other_equipment, p.warranty, p.first_service, p.service_interval],
    ['Full LED (série)', 'Oui (série)', 'TFT 6,5 pouces', 'Bluetooth', 'Série', 'Oui', 'Poignées chauffantes', '2 ans', '1 000 km', 'Tous les 10 000 km ou 1 an'],
  );
});

test('the template copied for ChatGPT lists every field of the form', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../components/admin/TechSpecsJsonImport.tsx', import.meta.url), 'utf8');
  for (const key of ['lighting', 'usb', 'dashboard', 'connectivity', 'cruiseControl', 'keyless', 'other', 'warranty', 'firstService', 'serviceInterval']) {
    assert.match(src, new RegExp(`\\b${key}: ''`), key);
  }
  assert.match(src, /jamais "à 8 600 tr\/min"/);
});
