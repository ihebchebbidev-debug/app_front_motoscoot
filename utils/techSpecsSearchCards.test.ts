import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../components/TechSpecsBrands.tsx', import.meta.url), 'utf8');
const section = page.slice(page.indexOf('CROSS-FIELD MODEL MATCHES'), page.indexOf('Error + retry surface'));

test('search cards: whole name, price, same labels as a brand page', () => {
  assert.match(section, /line-clamp-2/); // the name was cut on one line
  assert.match(section, /const price = priceLabel\(spec\.priceNew\);/);
  assert.match(section, /ccLabel\(spec\.engine\?\.cc\), powerLabel\(spec\.engine\?\.power\)/);
  assert.match(section, /font-bold text-primary-700 tabular-nums/);
});

test('search cards: 3 columns at most, category in the grey line, whole bike', () => {
  assert.match(section, /grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3/);
  assert.doesNotMatch(section, /lg:grid-cols-4|<Badge/);
  assert.match(section, /object-contain bg-gray-50/);
  assert.doesNotMatch(section, /aria-label=\{`Voir la fiche/); // the card reads its content
});

test('search cards: « Voir les N fiches » instead of « affinez votre recherche »', () => {
  assert.match(page, /const shownSpecs = showAllSpecs \? matchingSpecs : matchingSpecs\.slice\(0, 12\);/);
  assert.match(page, /useEffect\(\(\) => \{ setShowAllSpecs\(false\); \}, \[deferredBrandSearch\]\);/);
  assert.match(section, /Voir les \{matchingSpecs\.length\} fiches/);
  assert.doesNotMatch(section, /affinez votre recherche/);
});
