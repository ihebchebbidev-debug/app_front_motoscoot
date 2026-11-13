import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('shared controls keep the capitals by default and switch to the calm scale on request', () => {
  const scale = read('components/ui/TypeScale.tsx');
  assert.match(scale, /createContext<TypeTone>\('caps'\)/);
  assert.match(scale, /label: 'text-\[14px\] leading-\[1\.3\] font-semibold text-gray-900'/);
  assert.match(scale, /value: 'font-medium placeholder:font-normal'/);
  assert.match(scale, /calm: 'font-bold normal-case tracking-normal'/);
  for (const f of ['Input', 'Select']) assert.match(read(`components/ui/${f}.tsx`), /FIELD_TYPE\[useTypeTone\(\)\]/, f);
  assert.match(read('components/ui/Button.tsx'), /BUTTON_TYPE\[tone\]/);
});

test('only the deposit uses the calm scale, with sentence-case labels', () => {
  assert.match(read('components/DepositAd.tsx'), /<TypeScaleProvider tone="calm">/);
  const tech = read('components/deposit/StepTechnical.tsx');
  assert.doesNotMatch(tech, /label="[A-ZÉÈ' ()]{3,}"/);
  assert.match(read('components/deposit/CylinderField.tsx'), /label="Cylindrée"/); // « cc » is in each choice (« 125 cc »)
  const publish = read('components/deposit/StepPublish.tsx');
  assert.match(publish, /label="Prix \(DT\)"/);
  assert.doesNotMatch(publish, /uppercase/);
  assert.doesNotMatch(read('components/deposit/StepRecap.tsx'), /uppercase/);
  // Step titles: 800, tight tracking, no more Black.
  for (const f of ['StepTechnical', 'StepEquipment', 'StepPublish', 'StepRecap']) {
    assert.match(read(`components/deposit/${f}.tsx`), /text-\[26px\] md:text-3xl leading-\[1\.15\] font-extrabold/, f);
  }
});
