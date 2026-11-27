import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Password managers (iCloud Keychain, Google, 1Password) fill and save the
// login only when the fields say what they hold. Without autocomplete they
// guessed, and sign-up never offered a strong password.
const modal = readFileSync(new URL('../components/auth/LoginModal.tsx', import.meta.url), 'utf8');

test('the e-mail field is the login identifier', () => {
  // The field is registered as « email » in the form (its name attribute).
  assert.match(modal, /type="email"[\s\S]{0,300}\{\.\.\.field\('email'\)\}\s+autoComplete="username"/);
});

test('the password is the current one to sign in, a new one to sign up', () => {
  assert.match(modal, /<PasswordInput[\s\S]{0,250}autoComplete=\{isSignUp \? 'new-password' : 'current-password'\}/);
});

test('every sign-up field tells the browser what it holds', () => {
  for (const token of ['name', 'tel', 'organization']) {
    assert.match(modal, new RegExp(`autoComplete="${token}"`), token);
  }
  const inputs = modal.match(/<(Input|Select)\b[\s\S]*?\/?>/g) ?? [];
  for (const field of inputs) {
    assert.match(field, /autoComplete=/, field.slice(0, 80));
  }
});
