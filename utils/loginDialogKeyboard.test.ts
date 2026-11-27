import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The login window is a real dialog for keyboard and screen-reader users:
// named by its title, focus inside, Tab kept inside, Escape closes, focus
// back to the opener. Same behaviour as components/search/ChoiceSheet.tsx.
const modal = readFileSync(new URL('../components/auth/LoginModal.tsx', import.meta.url), 'utf8');

test('the dialog is named by its title', () => {
  assert.match(modal, /role="dialog"\s+aria-modal="true"\s+aria-labelledby=\{titleId\}/);
  assert.match(modal, /<h2 id=\{titleId\}/);
});

test('focus moves into the window without opening the phone keyboard', () => {
  assert.match(modal, /ref=\{panelRef\}\s+tabIndex=\{-1\}/);
  assert.match(modal, /panel\.focus\(\{ preventScroll: true \}\)/);
});

test('Escape closes, Tab stays inside, focus returns to the opener', () => {
  assert.match(modal, /e\.key === 'Escape'[\s\S]{0,80}onCloseRef\.current\(\)/);
  assert.match(modal, /e\.shiftKey && \(active === first/);
  assert.match(modal, /opener\.focus\(\{ preventScroll: true \}\)/);
});
