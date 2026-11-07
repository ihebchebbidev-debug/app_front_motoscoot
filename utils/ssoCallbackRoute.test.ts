import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isKnownPagePath } from './knownPages';

// Google sign-in returns to /sso-callback. If Vercel or the Node server does
// not serve the app there, the visitor lands on the 404 page and is never signed in.
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  rewrites: { source: string; destination: string }[];
};

test('the Google sign-in return address is the one the app serves', () => {
  const hook = readFileSync(new URL('../hooks/useClerkGoogleSignIn.ts', import.meta.url), 'utf8');
  assert.match(hook, /redirectUrl: `\$\{origin\}\/sso-callback`/);
  assert.match(hook, /redirectUrlComplete: `\$\{origin\}\/sso-callback`/);
});

test('/sso-callback is served by the app on Vercel and on the Node server', () => {
  assert.ok(
    vercel.rewrites.some((r) => r.source === '/sso-callback' && r.destination === '/spa.html'),
    'vercel.json must rewrite /sso-callback to /spa.html',
  );
  assert.equal(isKnownPagePath('/sso-callback'), true);
});

test('every vercel.json rewrite to /spa.html is a known page for the Node server', () => {
  for (const { source } of vercel.rewrites.filter((r) => r.destination === '/spa.html')) {
    const sample = source.replace('/:path*', '/x');
    assert.equal(isKnownPagePath(sample), true, source);
  }
});
