import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The « Connexion sécurisée SSL » badge was decoration: every page of the
// site is HTTPS and the browser already shows it. Nothing replaces it.
const modal = readFileSync(new URL('../components/auth/LoginModal.tsx', import.meta.url), 'utf8');

test('no decorative SSL badge in the login window', () => {
  assert.doesNotMatch(modal, /Connexion sécurisée SSL/);
  assert.doesNotMatch(modal, /CheckCircle2/);
});
