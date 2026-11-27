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

test('phones: emblem, « Bienvenue » and the promise shown large; header keeps only the close', () => {
  assert.match(modal, /<div className="text-center mb-6 \[@media\(max-height:700px\)\]:mb-3 md:text-left/);
  assert.match(modal, /w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100/);
  assert.match(sheet, /\? 'absolute top-1\.5 right-5 z-10 flex items-center md:static md:p-0'/);
});

test('short screens drop the small logo; the split window floats its close button', () => {
  assert.match(modal, /\[@media\(min-width:768px\)_and_\(max-height:780px\)\]:hidden/);
  assert.match(sheet, /aside \? 'relative md:absolute md:top-2 md:right-2 md:z-10' : ''/);
  assert.match(sheet, /md:h-\[min\(800px,calc\(100dvh-48px\)\)\]/);
});
