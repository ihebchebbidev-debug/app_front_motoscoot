import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('a focused field label stays readable (primary-700 = 5.0:1, was primary-600 = 3.7:1)', () => {
  for (const f of ['components/ui/Input.tsx', 'components/ui/Select.tsx']) {
    const src = read(f);
    assert.match(src, /group-focus-within:text-primary-700/, f);
    assert.doesNotMatch(src, /group-focus-within:text-primary-600/, f);
  }
});

test('preview initials are white on primary-700, and step 1 shows no greyed-out Retour', () => {
  const src = read('components/DepositAd.tsx');
  assert.match(src, /rounded-full bg-primary-700 text-white flex items-center justify-center font-black text-\[12px\]/);
  assert.doesNotMatch(src, /disabled=\{step === 1\}/);
  assert.match(src, /\{step > 1 && \(\s*<Button/);
  assert.equal(src.split('md:flex-initial md:ml-auto bg-primary-700').length - 1, 2);
});
