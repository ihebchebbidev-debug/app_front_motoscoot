import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { googleTapAction } from './googleTap';

test('a tap before Clerk has loaded waits instead of failing', () => {
  assert.equal(googleTapAction({ busy: false, configured: true, canStart: false }), 'wait');
});

test('a tap once Clerk is ready starts Google right away', () => {
  assert.equal(googleTapAction({ busy: false, configured: true, canStart: true }), 'start');
});

test('a second tap while waiting or redirecting does nothing', () => {
  assert.equal(googleTapAction({ busy: true, configured: true, canStart: false }), 'ignore');
  assert.equal(googleTapAction({ busy: true, configured: true, canStart: true }), 'ignore');
});

test('without a Clerk key the tap goes straight to its explanation', () => {
  assert.equal(googleTapAction({ busy: false, configured: false, canStart: false }), 'start');
});

test('the login window uses the rule, starts Google when Clerk is ready, and gives up after a delay', () => {
  const modal = readFileSync(new URL('../components/auth/LoginModal.tsx', import.meta.url), 'utf8');
  assert.match(modal, /googleTapAction\(/);
  assert.match(modal, /if \(clerkGoogle\.canStart\) \{\s*setGoogleWaiting\(false\);\s*void handleSocialLogin\('google'\);/);
  assert.match(modal, /GOOGLE_WAIT_MS/);
  assert.doesNotMatch(modal, /onClick=\{\(\) => handleSocialLogin\('google'\)\}/);
});
