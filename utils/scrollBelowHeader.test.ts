import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scrollTargetBelowHeader } from './scrollBelowHeader.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the scroll target leaves the element just below the fixed header', () => {
  // Card 400px down the viewport, page scrolled 600px, header 72px tall.
  assert.equal(scrollTargetBelowHeader(400, 600, 72, 12), 916);
  // Never a negative scroll.
  assert.equal(scrollTargetBelowHeader(50, 0, 72, 12), 0);
});

test('the deposit wizard never scrolls a step to the very top (under the header)', () => {
  const src = read('components/DepositAd.tsx');
  assert.doesNotMatch(src, /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
  assert.match(src, /stepWrapperRef\.current\?\.focus\(\{ preventScroll: true \}\);\s*revealBelowHeader\(mainCardRef\.current\);/);
  assert.match(src, /if \(firstStepRender\.current\) \{ firstStepRender\.current = false; return; \}/);
  // Errors: below the header with room for the label, not a fixed 120/80px.
  assert.match(src, /scrollBelowHeader\(target, 44\);/);
  assert.doesNotMatch(src, /const offset = isMobile \? 120 : 80;/);
});

test('?step= is synced after render, not from inside a state updater', () => {
  const src = read('components/DepositAd.tsx');
  assert.doesNotMatch(src, /setStepState\(\(prev\) => \{\s*const resolved/);
  assert.match(src, /setSearchParams\(params, \{ replace: true \}\);\s*\}, \[step, setSearchParams\]\);/);
});

test('phones hide the bottom bar while typing; no ad popup on the deposit form', () => {
  const src = read('components/DepositAd.tsx');
  assert.match(src, /typing \? 'max-md:translate-y-full max-md:pointer-events-none' : ''/);
  assert.doesNotMatch(read('components/PopupAd.tsx'), /'comparator',\s*'deposit'/);
});
