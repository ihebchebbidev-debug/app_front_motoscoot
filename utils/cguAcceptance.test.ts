import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('sign-up and Google sign-in say that continuing accepts the CGU, with a link to /conditions', () => {
  const src = readFileSync('components/auth/LoginModal.tsx', 'utf8');
  assert.match(src, /isSignUp \? 'En créant votre compte' : 'En continuant'\}, vous acceptez les/);
  assert.match(src, /href="\/conditions"\s+target="_blank"/);
});
