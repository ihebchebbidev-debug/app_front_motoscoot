import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('after publishing, the wizard shows a success screen instead of sending the seller home', () => {
  const src = read('components/DepositAd.tsx');
  assert.doesNotMatch(src, /onNavigate\?\.\('home'\)/);
  assert.doesNotMatch(src, /Redirection en cours/);
  assert.match(src, /<DepositSuccess listing=\{published\}/);
  // "Déposer une autre" starts a clean deposit.
  assert.match(src, /const startBlankDeposit = \(\) => \{\s*clearDraft\(\);[\s\S]*?reset\(emptyDepositValues\(\)\);\s*clearMedia\(\);[\s\S]*?setStep\(1\);/);
  assert.match(src, /const handleDepositAnother = \(\) => \{\s*startBlankDeposit\(\);\s*\};/);
});

test('the success screen offers the three actions and links to the public listing URL', () => {
  const src = read('components/deposit/DepositSuccess.tsx');
  for (const label of ['Voir mon annonce', 'Partager', 'Déposer une autre']) assert.match(src, new RegExp(`>\\s*${label}\\s*<`), label);
  assert.match(src, /getUrlFromState\('listing-details', \{ id: l\.id, title: l\.title, listingNumber: l\.listingNumber \}\)/);
  // Moderation: say it will be checked, never that it is already online.
  assert.match(src, /vérifie avant sa mise en ligne/);
});

test('publishListing returns what the success screen needs', () => {
  const src = read('services/listingService.ts');
  assert.match(src, /listingNumber: \(created as any\)\.listingNumber/);
  assert.match(src, /title: created\.title \|\| payload\.title/);
});
