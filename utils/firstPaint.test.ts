import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { firstPaintImage } from './detailHtml';
import { MAX_MS } from './firstPaint';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const shell = read('../index.html');
const index = shell;
const main = read('../index.tsx');
const layer = read('./firstPaint.ts');
const prerender = read('../api/og-prerender.ts');
const listing = read('../api/og-listing.ts');

test('the prepared page paints at once for JS visitors, no longer clipped to 1 px', () => {
  assert.match(shell, /html\.js \[data-seo-fallback\] \{ position:fixed; inset:0;/);
  assert.doesNotMatch(shell, /@media \(scripting: enabled\) \{ \[data-seo-fallback\]/);
  assert.doesNotMatch(shell, /html\.js \[data-seo-fallback\] \{ position:absolute!important; width:1px/);
  // Only the top of the page: breadcrumb, title, intro, main photo.
  assert.match(shell, /> :not\(nav\[aria-label="Fil d'Ariane"\]\):not\(h1\):not\(h1 \+ p\):not\(img\[data-first-paint\]\) \{ display:none; \}/);
  assert.match(shell, /url\(\/site-logo\/logo-color\.svg\)/); // the header bar of the site
  assert.match(shell, /animation:fp-out 0s linear 10s forwards/); // never stuck if the JS never runs
});

test('the home page keeps its photo shell; its text stays crawler-only', () => {
  assert.match(shell, /html\.js \[data-home-shell\] ~ \[data-seo-fallback\] \{ position:absolute!important; width:1px; height:1px;/);
});

test('the layer leaves #root before React mounts and goes once the page shows its title', () => {
  assert.ok(main.indexOf('holdFirstPaint(rootElement);') > 0);
  assert.ok(main.indexOf('holdFirstPaint(rootElement);') < main.indexOf('ReactDOM.createRoot(rootElement)'));
  assert.match(layer, /root\.parentNode\.insertBefore\(layer, root\);/);
  assert.match(layer, /if \(root\.querySelector\('h1'\)\)/);
  assert.match(layer, /\['wheel', 'touchmove', 'keydown'\]/);
  assert.equal(MAX_MS, 6000);
});

test('the main photo is in the prepared HTML, at the preload address', () => {
  assert.equal(
    firstPaintImage('/m/sym-jet-14.webp', 'SYM "Jet" 14 & co'),
    '<img data-first-paint="top" src="/m/sym-jet-14.webp" alt="SYM &quot;Jet&quot; 14 &amp; co" width="1200" height="900" fetchpriority="high" decoding="async" />',
  );
  assert.equal(firstPaintImage(null, 'x'), '');
  assert.match(prerender, /\$\{kind === 'fiche-technique' \? firstPaintImage\(lcpImage, heading\) : ''\}/);
  assert.doesNotMatch(index, /data-first-paint="after"/); // no photo under the text: it moved when the font arrived
  assert.match(listing, /\$\{firstPaintImage\(lcpImage, listing\.title \|\| ''\)\}\n<h1>/);
});
