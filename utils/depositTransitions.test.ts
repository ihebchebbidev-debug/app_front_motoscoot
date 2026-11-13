import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('steps enter from the right going forward, from the left going back, in 220 ms', () => {
  const css = read('src/styles/globals.css');
  assert.match(css, /\.ms-step-forward \{ animation: ms-step-in-right 220ms cubic-bezier\(0\.23, 1, 0\.32, 1\) both; \}/);
  assert.match(css, /\.ms-step-back \{ animation: ms-step-in-left 220ms/);
  assert.match(css, /translateX\(24px\)/);
  assert.match(css, /translateX\(-24px\)/);
  // Reduced motion: a short fade, no movement.
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.ms-step-forward, \.ms-step-back \{ animation: ms-step-fade 150ms/);
});

test('the wizard keys the entrance on the step and fixes its direction on step change only', () => {
  const src = read('components/DepositAd.tsx');
  // Keyed by the step (and the deposit run: a reset remounts it too).
  assert.match(src, /<div key=\{`\$\{depositRun\}-\$\{step\}`\} className=\{stepDirection\.current === 'back' \? 'ms-step-back' : 'ms-step-forward'\}>/);
  assert.match(src, /if \(lastStep\.current !== step\) \{\s*stepDirection\.current = step < lastStep\.current \? 'back' : 'forward';/);
  // The old slow upward slide is gone from every step.
  for (const f of ['StepMedia', 'StepTechnical', 'StepEquipment', 'StepPublish', 'StepRecap']) {
    assert.doesNotMatch(read(`components/deposit/${f}.tsx`), /animate-fade-in-up/, f);
  }
});
