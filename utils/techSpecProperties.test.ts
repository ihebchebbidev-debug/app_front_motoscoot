import { test } from 'node:test';
import assert from 'node:assert/strict';
import { techSpecProperties } from './techSpecSeo.ts';

test('spec properties are numbers with units, as stored on the SYM ADX 300 sheet', () => {
  assert.deepEqual(
    techSpecProperties({ cc: '278 cc', power: '26 ch', torque: '26 Nm', topSpeed: '130 km/h', consumption: '3.5 L/100 km', weight: '200 kg', tank: '16 L' }),
    [
      { '@type': 'PropertyValue', name: 'Cylindrée', value: 278, unitCode: 'CMQ', unitText: 'cm³' },
      { '@type': 'PropertyValue', name: 'Puissance', value: 26, unitText: 'ch' },
      { '@type': 'PropertyValue', name: 'Couple', value: 26, unitCode: 'NU', unitText: 'Nm' },
      { '@type': 'PropertyValue', name: 'Vitesse max', value: 130, unitCode: 'KMH', unitText: 'km/h' },
      { '@type': 'PropertyValue', name: 'Consommation', value: 3.5, unitText: 'L/100 km' },
      { '@type': 'PropertyValue', name: 'Poids', value: 200, unitCode: 'KGM', unitText: 'kg' },
      { '@type': 'PropertyValue', name: 'Réservoir', value: 16, unitCode: 'LTR', unitText: 'L' },
    ],
  );
});

test('kW power is converted to ch; extra text after the number is ignored; missing / N/A values are left out', () => {
  const rows = techSpecProperties({ cc: '124.7 cc', power: '9.3 kW (12.6 ch) à 8000 tr/min', torque: '11.5 Nm à 6000 tr/min', topSpeed: 'N/A' });
  assert.deepEqual(rows.map((r) => [r.name, r.value]), [['Cylindrée', 124.7], ['Puissance', 12.6], ['Couple', 11.5]]);
  assert.deepEqual(techSpecProperties({}), []);
});
