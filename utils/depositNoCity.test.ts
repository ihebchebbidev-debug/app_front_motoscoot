import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the price step asks for the governorate only, not the city', () => {
  const step = read('components/deposit/StepPublish.tsx');
  assert.doesNotMatch(step, /label="(VILLE|Ville)"/);
  assert.doesNotMatch(step, /register\('city'\)/);
  assert.match(step, /label="Gouvernorat"/);
  const wizard = read('components/DepositAd.tsx');
  assert.match(wizard, /return \['price', 'governorate', 'phone', 'description'\];/);
  assert.match(read('types/listing.ts'), /city: z\.string\(\)\.optional\(\)/);
});

test('without a city the listing still has a place: cards fall back to the governorate', () => {
  assert.match(read('services/listingService.ts'), /city: \(data\.city && String\(data\.city\)\.trim\(\)\) \|\| null,/);
  assert.match(read('services/listingsApi.ts'), /location: b\.city \|\| b\.governorate/);
});

test('an empty governorate shows its own message (it is the only place field)', () => {
  assert.match(read('types/listing.ts'), /governorate: z\.string\(\)\.trim\(\)\.min\(1, 'Veuillez choisir un gouvernorat'\)/);
});
