import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('deposit side panel and steps keep text at 4.5:1 and at least 11px', () => {
  const estimator = read('components/deposit/PriceEstimator.tsx');
  assert.doesNotMatch(estimator, /text-\[(8|9)px\]|text-gray-(300|400) uppercase|text-gray-400 uppercase/);
  const wizard = read('components/DepositAd.tsx');
  assert.match(wizard, /text-\[16px\] font-\[900\] text-primary-700/);
  assert.doesNotMatch(wizard, /font-medium text-gray-400 leading-tight">\{previewRole\}/);
  assert.doesNotMatch(wizard, /bg-card\/90 backdrop-blur-md px-2\.5/);
  const tech = read('components/deposit/StepTechnical.tsx');
  assert.doesNotMatch(tech, /text-\[9px\] font-black text-gray-300/);
});

test('placeholders are readable (gray-500 on gray-50 = 4.6:1) and no card is nested in the step card', () => {
  assert.match(read('components/ui/Input.tsx'), /placeholder:text-gray-500/);
  const publish = read('components/deposit/StepPublish.tsx');
  assert.match(publish, /leading-relaxed placeholder:text-gray-500/);
  assert.doesNotMatch(publish, /rounded-2xl border border-gray-200 bg-gray-50\/60 p-4/);
});
