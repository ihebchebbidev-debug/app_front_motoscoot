import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHIME_NOTES } from './successSound.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the chime is an original rising fifth (C6 → G6), synthesised, no audio file', () => {
  assert.deepEqual([...CHIME_NOTES], [1046.5, 1568]);
  const src = read('utils/successSound.ts');
  assert.doesNotMatch(src, /\.(mp3|wav|ogg|m4a)/);
  // iPhone silent switch stays in charge; hidden tabs stay silent.
  assert.match(src, /audioSession\.type = 'ambient'/);
  assert.match(src, /document\.hidden\) return/);
});

test('sound is unlocked by the Publier click and played once by the success screen', () => {
  assert.match(read('components/DepositAd.tsx'), /const handlePublish = async \(\) => \{\s*\/\/[^\n]*\n\s*primeSuccessSound\(\);/);
  const success = read('components/deposit/DepositSuccess.tsx');
  assert.match(success, /if \(!soundPlayed\.current\) \{\s*soundPlayed\.current = true;\s*playSentSound\(\);/);
  assert.match(success, /<SentEnvelope photo=\{listing\.image\} \/>/);
});

test('the envelope animation is decorative and has a reduced-motion version', () => {
  const env = read('components/deposit/SentEnvelope.tsx');
  assert.match(env, /className="mse-stage" aria-hidden="true"/);
  assert.match(env, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(env, /\.mse-env, \.mse-trail, \.mse-confetti, \.mse-flap-back \{ display: none; \}/);
});
