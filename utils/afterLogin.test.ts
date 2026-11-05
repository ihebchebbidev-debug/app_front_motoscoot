import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Minimal sessionStorage for node.
const store = new Map<string, string>();
(globalThis as any).sessionStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};
const { rememberAfterLogin, takeAfterLogin, peekAfterLogin, forgetAfterLogin, isSafeAfterLoginPath, DEPOSIT_PATH } = await import('./afterLogin.ts');

beforeEach(() => store.clear());

test('only same-site paths are accepted', () => {
  assert.equal(isSafeAfterLoginPath('/deposer-une-annonce'), true);
  assert.equal(isSafeAfterLoginPath('/mon-compte?tab=annonces'), true);
  for (const bad of ['https://evil.example/x', '//evil.example', '/\\evil', 'deposer', '/', '/sso-callback', '/sso-callback?x=1', null, 42]) {
    assert.equal(isSafeAfterLoginPath(bad), false, String(bad));
  }
});

test('the destination survives until taken, then is gone', () => {
  rememberAfterLogin(DEPOSIT_PATH);
  assert.equal(peekAfterLogin(), DEPOSIT_PATH);
  assert.equal(takeAfterLogin(), DEPOSIT_PATH);
  assert.equal(takeAfterLogin(), null);
});

test('closing the sign-in window forgets it, and it expires after 30 minutes', () => {
  rememberAfterLogin(DEPOSIT_PATH);
  forgetAfterLogin();
  assert.equal(takeAfterLogin(), null);
  rememberAfterLogin(DEPOSIT_PATH);
  assert.equal(takeAfterLogin(Date.now() + 31 * 60 * 1000), null);
});

test('the header, the auth gate and the Google callback all use it', () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const header = read('components/layout/Header.tsx');
  assert.equal(header.split('onClick={openDeposit}').length - 1, 3);
  assert.doesNotMatch(header, /handleNavClick\('deposit'\) : triggerLogin\(\)/);
  const app = read('App.tsx');
  assert.match(app, /rememberAfterLogin\(window\.location\.pathname \+ window\.location\.search\);\s*triggerLogin\(\);/);
  assert.match(app, /const next = takeAfterLogin\(\);/);
  assert.match(app, /onClose=\{handleLoginClose\}/);
  assert.match(read('components/auth/ClerkAuthBridge.tsx'), /navigate\(takeAfterLogin\(\) \?\? '\/', \{ replace: true \}\)/);
});
