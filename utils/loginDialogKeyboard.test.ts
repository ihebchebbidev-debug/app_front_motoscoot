import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The login window is the site's shared sheet (ChoiceSheet), like sort,
// filters and quote request: named by its title, focus inside without the
// phone keyboard, Tab kept inside, Escape closes, focus back to the opener,
// drag down to close on phones, same exit path as the entry.
const modal = readFileSync(new URL('../components/auth/LoginModal.tsx', import.meta.url), 'utf8');
const sheet = readFileSync(new URL('../components/search/ChoiceSheet.tsx', import.meta.url), 'utf8');

test('the login window is the shared sheet, titled by its screen', () => {
  assert.match(modal, /<ChoiceSheet\s+open=\{isOpen\}\s+label=\{isSignUp \? 'Créer un compte' : 'Bienvenue sur moto-scoot\.tn'\}\s+onClose=\{onClose\}\s+listbox=\{false\}/);
  assert.doesNotMatch(modal, /role="dialog"/);
  assert.doesNotMatch(modal, /if \(!isOpen\) return null;/, 'unmounting at once would skip the exit animation');
});

test('the shared sheet keeps keyboard and screen-reader behaviour', () => {
  assert.match(sheet, /role="dialog"\s+aria-modal="true"\s+aria-labelledby=\{titleId\}/);
  assert.match(sheet, /e\.key !== 'Escape'/);
  assert.match(sheet, /e\.shiftKey && \(active === first/);
  assert.match(sheet, /back\.focus\(\{ preventScroll: true \}\)/);
  assert.match(sheet, /shouldCloseSheet\(d\.dy, height, velocity\)/);
});
