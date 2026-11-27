import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Every field of the login window has a visible label tied to it (the shared
// Input links <label for>). E-mail and password had only a placeholder: it
// vanished on typing and screen readers read « votre@email.com ».
const modal = readFileSync(new URL('../components/auth/LoginModal.tsx', import.meta.url), 'utf8');

test('e-mail and password carry a visible label', () => {
  assert.match(modal, /<Input\s+label="Adresse e-mail"\s+type="email"/);
  assert.match(modal, /<PasswordInput\s+label="Mot de passe"/);
});

test('no text field of the login window relies on its placeholder alone', () => {
  const inputs = modal.match(/<Input\b[\s\S]*?className=\{inputCompactClass\}/g) ?? [];
  assert.ok(inputs.length >= 7);
  for (const field of inputs) assert.match(field, /\blabel="/, field.slice(0, 120));
});
