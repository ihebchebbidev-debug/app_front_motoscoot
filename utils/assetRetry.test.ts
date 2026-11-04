import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addAssetRetry } from './assetRetry.ts';

// Tags as Vite writes them in dist/index.html.
const BUILT = `<head>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter" />
<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet" media="print" onload="this.media='all'" />
<script type="module" crossorigin src="/assets/index-29Nx2mwb.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-abc.js">
<link rel="stylesheet" crossorigin href="/assets/index-PJs1wiES.css">
</head>`;

test('the entry stylesheet repairs the cached file and retries under a fresh URL', () => {
  const tag = addAssetRetry(BUILT).match(/<link rel="stylesheet" crossorigin href="\/assets\/index-PJs1wiES\.css"[^>]*>/)?.[0] ?? '';
  assert.match(tag, /onerror="this\.onerror=null;fetch\(this\.href,\{cache:'reload'\}\)/);
  assert.match(tag, /\?retry='\+Date\.now\(\)"/);
});

test('the entry script repairs the cached file, then reloads once (10 s guard)', () => {
  const tag = addAssetRetry(BUILT).match(/<script type="module" crossorigin src="\/assets\/index-29Nx2mwb\.js"[^>]*>/)?.[0] ?? '';
  assert.match(tag, /fetch\(this\.src,\{cache:'reload'\}\)\.then\(function\(r\)\{if\(!r\.ok\)return;/);
  assert.match(tag, /Date\.now\(\)-t<1e4\)return;/);
  assert.match(tag, /location\.reload\(\)/);
});

test('fonts, preloads and modulepreloads are left alone', () => {
  const out = addAssetRetry(BUILT);
  assert.equal(out.match(/ onerror="/g)?.length, 2);
  assert.ok(out.includes(`<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet" media="print" onload="this.media='all'" />`));
  assert.ok(out.includes('<link rel="modulepreload" crossorigin href="/assets/vendor-abc.js">'));
});

test('running it twice does not add a second handler', () => {
  const once = addAssetRetry(BUILT);
  assert.equal(addAssetRetry(once), once);
});

test('handlers fit in a double-quoted HTML attribute', () => {
  for (const [, handler] of addAssetRetry(BUILT).matchAll(/onerror="([^"]*)"/g)) {
    assert.ok(!handler.includes('"'), 'no double quote inside the attribute');
  }
});
