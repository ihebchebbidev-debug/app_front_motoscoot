import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../index.tsx', import.meta.url), 'utf8');

// PR #112 painted the prepared text over the page until React showed its own
// title. On real phones visitors saw a white screen, then only a title and one
// line, then grey placeholders: it read as a broken page (owner, 2026-11-11).
// The prepared text stays for crawlers only, clipped for JS visitors.
test('the prepared text is crawler-only again: clipped for JS visitors, no layer over the page', () => {
  assert.match(shell, /html\.js \[data-seo-fallback\] \{ position:absolute!important; width:1px; height:1px; overflow:hidden; clip:rect\(0 0 0 0\); white-space:nowrap; \}/);
  assert.doesNotMatch(shell, /\[data-seo-fallback\] \{ position:fixed/);
  assert.doesNotMatch(main, /holdFirstPaint/);
});
