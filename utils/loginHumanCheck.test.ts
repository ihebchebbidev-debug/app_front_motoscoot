import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

// « Je suis humain » is a plain checkbox on the « Mot de passe oublié ? »
// row: no Cloudflare look-alike, no fake wait, no greyed-out button.
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const modal = read('components/auth/LoginModal.tsx');
const check = read('components/auth/HumanCheck.tsx');

test('the Cloudflare look-alike is gone', () => {
  assert.equal(existsSync(new URL('../components/auth/CloudflareTurnstileMock.tsx', import.meta.url)), false);
  assert.doesNotMatch(modal, /Cloudflare|Turnstile/);
});

test('a real, labelled checkbox with a 44 px row, ticked at once', () => {
  assert.match(check, /type="checkbox"/);
  assert.match(check, /<label htmlFor=\{id\} className="min-h-\[44px\]/);
  assert.match(check, /Je suis humain/);
  assert.doesNotMatch(check, /setTimeout/);
});

test('it sits on the « Mot de passe oublié ? » row', () => {
  assert.match(modal, /<div className="flex items-start justify-between gap-3 -mb-1">\s*<HumanCheck/);
  assert.match(modal, /<HumanCheck[\s\S]{0,1200}'Mot de passe oublié \?'/);
});

test('the button stays active; an unticked box is said under it and focused', () => {
  assert.match(modal, /disabled=\{loading\}/);
  assert.doesNotMatch(modal, /disabled=\{loading \|\| !notRobot\}/);
  assert.match(modal, /setRobotError\(true\);\s*humanCheckRef\.current\?\.focus\(\);/);
  assert.match(modal, /'Cochez la case pour continuer\.'/);
});
