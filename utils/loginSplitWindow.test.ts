import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Tablet and desktop: the login window is a split window, picture card on
// the left and the form on the right. Phones keep the plain sheet.
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const sheet = read('components/search/ChoiceSheet.tsx');
const modal = read('components/auth/LoginModal.tsx');

test('the picture panel shows only from 768 px and is not read aloud', () => {
  assert.match(sheet, /<div className="hidden md:block [^"]*" aria-hidden="true">\s*\{aside\}/);
});

test('sheets without a picture keep their exact layout (wrapper takes no space)', () => {
  assert.match(sheet, /className=\{aside \? 'flex flex-col flex-1 min-w-0 min-h-0' : 'contents'\}/);
  assert.match(sheet, /: `md:max-w-md md:rounded-2xl \$\{tall \? 'h-\[85dvh\] md:h-auto' : ''\}`/);
});

test('with a picture, the window keeps its name for screen readers', () => {
  assert.match(sheet, /<h2 id=\{titleId\} className=\{`text-base font-bold text-gray-900 \$\{aside \? 'md:sr-only' : ''\}`\}>/);
});

test('the login window passes its picture, swappable in one place', () => {
  assert.match(modal, /aside=\{<LoginAside isSignUp=\{isSignUp\} \/>\}/);
  assert.match(modal, /const LOGIN_PHOTO =/);
  assert.match(modal, /<img\s+src=\{LOGIN_PHOTO\}\s+alt=""/);
});
