import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the step header says where I am, what comes next, and names the steps on wide screens', () => {
  const src = read('components/deposit/StepProgress.tsx');
  assert.match(src, /<nav aria-label="Progression du dépôt"/);
  assert.match(src, /next \? `Ensuite : \$\{next\}` : 'Dernière étape'/);
  assert.match(src, /aria-current=\{i \+ 1 === step \? 'step' : undefined\}/);
  assert.match(src, /aria-label=\{`Revenir à l'étape \$\{n\} : \$\{name\}`\}/);
  assert.match(src, /hidden xl:grid/);
  // No grey band any more.
  assert.doesNotMatch(src, /bg-gray-50 border-b/);
});

test('the wizard passes the step names and only lets you jump back', () => {
  const src = read('components/DepositAd.tsx');
  assert.match(src, /steps=\{stepNames\}/);
  assert.match(src, /onStepClick=\{\(n\) => \{ if \(n < step\) setStep\(n\); \}\}/);
  for (const f of ['StepTechnical', 'StepEquipment', 'StepPublish']) {
    assert.doesNotMatch(read(`components/deposit/${f}.tsx`), /text-center md:text-left/, f);
  }
});
