import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The sign-in screen fits without scrolling (checked in the browser at
// 1280×800, 1366×768, 1440×900, 1024×768, 768×1024, 390×844, 375×812).
// These guard the choices that made it fit.
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const modal = read('components/auth/LoginModal.tsx');
const sheet = read('components/search/ChoiceSheet.tsx');

test('the title is just « Bienvenue »', () => {
  assert.match(modal, /label=\{isSignUp \? 'Créer un compte' : 'Bienvenue'\}/);
  assert.doesNotMatch(modal, /Bienvenue sur/);
});

test('Google and « Se connecter » are the same size and shape', () => {
  assert.match(modal, /w-full h-\[52px\] min-h-\[52px\] border border-gray-300 rounded-xl text-foreground font-bold text-\[16px\]/);
  assert.match(modal, /className="mt-1 h-\[52px\] text-\[16px\]"/);
});

test('phones: the sheet header names the screen, so no repeated intro', () => {
  assert.match(modal, /<div className="hidden md:block md:mb-6 md:text-left/);
});

test('short screens drop the small logo; the split window floats its close button', () => {
  assert.match(modal, /\[@media\(max-height:780px\)\]:hidden/);
  assert.match(sheet, /aside \? 'md:absolute md:top-2 md:right-2 md:z-10' : ''/);
  assert.match(sheet, /md:h-\[min\(800px,calc\(100dvh-48px\)\)\]/);
});
