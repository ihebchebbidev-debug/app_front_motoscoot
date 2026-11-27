import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The login window uses the deposit's calm type scale and plain words:
// sentence-case labels and buttons, readable help, an eye on the password,
// the password rule shown before typing, a thumb-sized « forgot » link.
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const modal = read('components/auth/LoginModal.tsx');
const input = read('components/ui/Input.tsx');
const password = read('components/ui/PasswordInput.tsx');

test('the whole window is in the calm tone, like the deposit', () => {
  assert.match(modal, /<TypeScaleProvider tone="calm">/);
});

test('plain words: « Se connecter », « ou », « Mot de passe oublié ? »', () => {
  assert.match(modal, /'Créer mon compte' : 'Se connecter'/);
  assert.doesNotMatch(modal, /OU EMAIL|Me connecter/);
  assert.match(modal, />ou<\/span>/);
  assert.match(modal, /'Mot de passe oublié \?'/);
  assert.match(modal, /min-h-\[44px\][^"]*text-\[14px\]/);
});

test('help text is 13 px, readable, and read with its field', () => {
  assert.match(input, /\{!error && hint && <p id=\{hintId\} className="text-\[13px\] leading-snug text-gray-600/);
  assert.match(input, /aria-describedby=\{error \? errorId : hint \? hintId/);
  assert.doesNotMatch(modal, /text-\[11px\] text-gray-400/);
});

test('password: eye button (44 px, named), rule shown at sign-up', () => {
  assert.match(password, /aria-label=\{visible \? 'Masquer le mot de passe' : 'Afficher le mot de passe'\}/);
  assert.match(password, /w-11 h-11/);
  assert.match(modal, /hint=\{isSignUp \? `\$\{PASSWORD_MIN\} caractères minimum\.` : undefined\}/);
});
