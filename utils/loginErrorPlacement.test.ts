import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// On a phone the sign-up button is ~600 px below the top of the form: an
// error shown at the top was off screen and the button looked dead. Each
// error now appears next to the control that caused it, and is announced.
const modal = readFileSync(new URL('../components/auth/LoginModal.tsx', import.meta.url), 'utf8');

test('one error banner per place, no banner left at the top of the form', () => {
  assert.equal((modal.match(/<ErrorNote /g) ?? []).length, 3);
  assert.doesNotMatch(modal, /\{error && \(\s*<div className="mb-5 p-4 rounded-xl bg-red-50/);
});

test('sign-in and sign-up errors sit just above the button and are scrolled into view', () => {
  assert.match(modal, /<div ref=\{submitAreaRef\}>\s*\{error && errorAt === 'form' && <ErrorNote[\s\S]{0,120}<Button\s+type="submit"/);
  assert.match(modal, /submitAreaRef\.current\?\.scrollIntoView\(\{ block: 'nearest'/);
  assert.match(modal, /prefers-reduced-motion: reduce/);
});

test('Google and forgotten-password errors sit under their own control', () => {
  assert.match(modal, /Continuer avec Google<\/span>[\s\S]{0,200}errorAt === 'google' && <ErrorNote/);
  assert.match(modal, /Mot de passe oublié \?'\}[\s\S]{0,200}errorAt === 'forgot' && \(\s*<ErrorNote/);
});

test('each action says where its error goes, and errors are announced', () => {
  assert.match(modal, /const handleSubmit = \(e: React\.FormEvent\) => \{\s*e\.preventDefault\(\);\s*setErrorAt\('form'\)/);
  assert.match(modal, /const handleForgotPassword = async \(\) => \{\s*setErrorAt\('forgot'\)/);
  assert.match(modal, /const handleSocialLogin = async[\s\S]{0,80}setErrorAt\('google'\)/);
  assert.match(modal, /<div role="alert"/);
});
