import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../components/TechSpecsDetails.tsx', import.meta.url), 'utf8');

test('fiche, phones: a floating dark frosted capsule, not a bar glued to the edges', () => {
  assert.doesNotMatch(page, /fixed bottom-0 left-0 right-0/);
  assert.match(page, /FloatBar: "lg:hidden fixed z-50 left-3 right-3 bottom-\[calc\(0\.75rem\+env\(safe-area-inset-bottom\)\)\] mx-auto max-w-md h-14 p-1 /);
  assert.match(page, /rounded-full bg-\[rgba\(22,26,34,0\.8\)\] backdrop-blur-2xl backdrop-saturate-\[1\.8\]/);
  assert.match(page, /\[@media\(prefers-reduced-transparency:reduce\)\]:bg-\[#161a22\]/); // solid when asked
  assert.match(page, /role="region" aria-label="Prix et actions"/);
});

test('the capsule keeps the price, the call button and « Comparer » (a smaller 40 px pill)', () => {
  assert.match(page, /\{spec\.priceNew\}<\/span>\s*<span[^>]*>Prix neuf TTC<\/span>/);
  assert.match(page, />Prix non communiqué</); // no empty slot without a price
  assert.match(page, /FloatCall: "shrink-0 w-12 h-12 /);
  assert.match(page, /href=\{`tel:\$\{spec\.importer\.phone\.replace/);
  assert.match(page, /FloatCompare: "shrink-0 h-10 /);
  assert.match(page, /onClick=\{handleCompare\}>\s*<ArrowLeftRight[^>]*className="max-\[359px\]:hidden" \/>\s*Comparer/);
  assert.match(page, /active:scale-\[0\.96\]/); // answers the finger at once
});

test('the page leaves room under its last line for the capsule and the iPhone home bar', () => {
  assert.match(page, /pb-\[calc\(7rem\+env\(safe-area-inset-bottom\)\)\] md:pb-20/);
});
