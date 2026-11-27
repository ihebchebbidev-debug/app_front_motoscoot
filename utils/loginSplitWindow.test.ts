import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

// Tablet and desktop: the login window is a split window, picture card on
// the left and the form on the right. Phones keep the plain sheet.
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const sheet = read('components/search/ChoiceSheet.tsx');
const modal = read('components/auth/LoginModal.tsx');

test('the picture panel shows only from 768 px; its decoration is not read aloud', () => {
  // The panel holds the social links, so only its decoration is aria-hidden.
  assert.match(sheet, /<div className="hidden md:block w-\[42%\] lg:w-\[46%\] shrink-0">\s*\{aside\}/);
  assert.match(modal, /<img\s+src=\{LOGIN_PHOTO\}\s+srcSet=\{LOGIN_PHOTO_SRCSET\}[\s\S]{0,80}alt=""/);
  assert.match(modal, /<p aria-hidden="true" className="relative px-8/);
});

test('sheets without a picture keep their exact layout (wrapper takes no space)', () => {
  assert.match(sheet, /className=\{aside \? 'relative flex flex-col flex-1 min-w-0 min-h-0' : 'contents'\}/);
  assert.match(sheet, /: `md:max-w-md md:rounded-2xl \$\{tall \? 'h-\[85dvh\] md:h-auto' : ''\}`/);
});

test('with a picture, the window keeps its name for screen readers', () => {
  assert.match(sheet, /<h2 id=\{titleId\} className=\{`text-base font-bold text-gray-900 \$\{aside \? 'sr-only' : ''\}`\}>/);
});

test('the login window passes its picture, swappable in one place', () => {
  assert.match(modal, /aside=\{<LoginAside isSignUp=\{isSignUp\} \/>\}/);
  assert.match(modal, /const LOGIN_PHOTO =/);
  assert.match(modal, /<img\s+src=\{LOGIN_PHOTO\}\s+srcSet=\{LOGIN_PHOTO_SRCSET\}[\s\S]{0,80}alt=""/);
});

test('the picture is the site own photo, light, in two widths', () => {
  assert.match(modal, /const LOGIN_PHOTO = '\/images\/connexion\/photo-connexion-898\.webp';/);
  assert.match(modal, /photo-connexion-450\.webp 450w, \/images\/connexion\/photo-connexion-898\.webp 898w/);
  assert.doesNotMatch(modal, /images\.unsplash\.com/);
  for (const w of [450, 898]) {
    const size = statSync(new URL(`../public/images/connexion/photo-connexion-${w}.webp`, import.meta.url)).size;
    assert.ok(size < 150 * 1024, `photo ${w} px weighs ${size} bytes`);
  }
});
