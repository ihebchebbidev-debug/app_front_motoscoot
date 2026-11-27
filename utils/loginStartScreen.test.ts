import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// « S'inscrire » opened the sign-in screen, the window reopened on the last
// screen used, and switching screens kept the scroll position (title hidden).
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const header = read('components/layout/Header.tsx');
const modal = read('components/auth/LoginModal.tsx');
const nav = read('context/NavigationContext.tsx');

test('each header button opens the screen it names', () => {
  assert.match(header, /aria-label="Connexion"/);
  assert.match(header, /onClick=\{\(\) => triggerLogin\('login'\)\}[^>]*aria-label="Connexion"/);
  assert.match(header, /onClick=\{\(\) => triggerLogin\('signup'\)\}[^>]*aria-label="Inscription"/);
  assert.match(header, /triggerLogin\('login'\); \}\}[\s\S]{0,400}Se connecter/);
  assert.match(header, /triggerLogin\('signup'\); \}\}[\s\S]{0,400}S'inscrire/);
});

test('a click event passed as the mode opens the sign-in screen', () => {
  assert.match(nav, /setLoginModalMode\(mode === 'signup' \? 'signup' : 'login'\)/);
});

test('every opening starts on the requested screen, at the top', () => {
  assert.match(modal, /if \(isOpen\) setIsSignUp\(initialMode === 'signup'\);/);
  assert.match(modal, /scroller\.scrollTop = 0;[\s\S]{0,20}\}, \[isSignUp, isOpen\]\);/);
  // The sheet's scrolling body is the parent of the login content.
  assert.match(modal, /const scroller = contentRef\.current\?\.parentElement;/);
  assert.match(modal, /<div ref=\{contentRef\}/);
});
