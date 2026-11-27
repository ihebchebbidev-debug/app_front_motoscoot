import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Phones: the login sheet fits its content and may grow to nearly the full
// height; short phones tighten the spacing; the keyboard keys and the
// focused field behave as on native forms. Checked in the browser with no
// scrolling at 375×667, 360×780, 393×852 and 430×932.
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const sheet = read('components/search/ChoiceSheet.tsx');
const modal = read('components/auth/LoginModal.tsx');

test('the login sheet may grow to nearly full height on phones', () => {
  assert.match(modal, /listbox=\{false\}\s+tall\s+large\s+aside=/);
  assert.match(sheet, /large \? 'max-md:!max-h-\[calc\(100dvh-12px\)\]'/);
});

test('short phones tighten the spacing, same hierarchy', () => {
  assert.match(modal, /\[@media\(max-height:700px\)\]:space-y-3/);
});

test('phone keyboard: « Suivant » on the e-mail goes to the password', () => {
  assert.match(modal, /enterKeyHint="next"/);
  assert.match(modal, /form\.setFocus\('password'\)/);
  assert.match(modal, /enterKeyHint=\{isSignUp \? 'done' : 'go'\}/);
  assert.match(modal, /autoCorrect="off"/);
});

test('the touched field is brought above the phone keyboard', () => {
  assert.match(modal, /onFocus=\{keepFocusedFieldVisible\}/);
  assert.match(modal, /field\.scrollIntoView\(\{ block: 'center'/);
});
