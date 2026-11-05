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
  assert.match(src, /hidden xl:block relative/);
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

test('wide screens: first and last steps sit on the content edges, names on one line, balanced spacing', () => {
  const src = read('components/deposit/StepProgress.tsx');
  assert.match(src, /\? \{ left: 0 \}\s*: last\s*\? \{ right: 0 \}/);
  assert.match(src, /left: `calc\(\$\{at\} \* \(100% - 24px\) \+ 12px\)`, transform: 'translateX\(-50%\)'/);
  assert.match(src, /whitespace-nowrap text-\[13px\] leading-\[18px\]/);
  assert.match(src, /flex h-6 w-6 shrink-0/);
  // 40 px above the steps (nav pt-10) and 40 px below (step area xl:pt-10).
  assert.match(read('components/DepositAd.tsx'), /md:pt-8 xl:pt-10/);
});
