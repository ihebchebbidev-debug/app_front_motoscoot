import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// WCAG AA: 4.5:1 for normal text. Measured on the deposit wizard (light theme):
// primary-600 on white 3.74, gray-400 on white 2.97, primary-700 5.04, gray-500 4.85.
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the step counter uses the darker orange and themed greys', () => {
  const src = read('components/deposit/StepProgress.tsx');
  assert.match(src, /font-black text-primary-700 uppercase tracking-\[0\.2em\]/);
  // neutral-* is not themed: in dark mode the header stayed light and "83%" vanished.
  assert.doesNotMatch(src, /neutral-/);
});

test('the Suivant / Publier buttons reach 4.5:1 in both themes', () => {
  const src = read('components/DepositAd.tsx');
  const cls = 'bg-primary-700 dark:text-gray-50 dark:hover:bg-primary-600';
  assert.equal(src.split(cls).length - 1, 2);
});

test('labels and hints of the price and recap steps are not gray-400', () => {
  for (const f of ['components/deposit/StepPublish.tsx', 'components/deposit/StepRecap.tsx']) {
    const src = read(f);
    assert.doesNotMatch(src, /Label: ["'][^"']*text-gray-400/, f);
    assert.doesNotMatch(src, /text-\[11px\] font-medium text-gray-400/, f);
  }
  const publish = read('components/deposit/StepPublish.tsx');
  assert.match(publish, /TemplateButton: "[^"]*text-primary-700/);
  assert.match(publish, /<span className="text-red-600 dark:text-red-400">\*<\/span>/);
});
