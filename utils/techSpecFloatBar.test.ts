import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { capsulePrice } from './capsulePrice';
import { telHref } from './phoneUtils';

const page = readFileSync(new URL('../components/TechSpecsDetails.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8');
const NNBSP = ' '; // what fmtPrice's toLocaleString('fr-FR') puts between thousands

test('fiche, phones: a floating white frosted capsule, not a bar glued to the edges', () => {
  assert.doesNotMatch(page, /fixed bottom-0 left-0 right-0/);
  assert.match(page, /FloatBar: "ms-capsule lg:hidden fixed z-50 left-3 right-3 bottom-\[calc\(0\.75rem\+env\(safe-area-inset-bottom\)\)\] mx-auto max-w-md h-14 p-1 /);
  assert.match(page, /role="region" aria-label="Prix et actions"/);
  assert.doesNotMatch(page, /WorstCase|applyWorstCase/); // the break-ui switch stayed local
});

test('an amount: « 9 000 DT » with « Prix neuf TTC » under it, never cut', () => {
  assert.deepEqual(capsulePrice(`9${NNBSP}000 DT`), { kind: 'amount', main: `9${NNBSP}000 DT`, sub: 'Prix neuf TTC' });
  assert.equal(capsulePrice(`1${NNBSP}249${NNBSP}999,5 DT`).kind, 'amount');
  assert.match(page, /tabular-nums whitespace-nowrap">\{capsule\.main\}<\/span>/); // no truncate on the amount
});

test('text typed in the admin: shown in full on two lines, without « Prix neuf TTC »', () => {
  assert.deepEqual(capsulePrice('Sur demande'), { kind: 'text', main: 'Sur demande', sub: null });
  assert.equal(capsulePrice('À partir de 35 000 DT (selon finition)').kind, 'text'); // 38 of the column's 50 characters
  assert.match(page, /line-clamp-2 break-words">\{capsule\.main\}/);
  assert.match(page, /title=\{capsule\.kind === 'text' \? capsule\.main : undefined\}/);
});

test('no price (fmtPrice gives « — »): « Prix non communiqué »', () => {
  for (const raw of ['—', '', null, undefined, 'N/C', 'n/c']) assert.equal(capsulePrice(raw).main, 'Prix non communiqué', String(raw));
});

test('call link: always the first number, with +216 for a Tunisian one', () => {
  assert.equal(telHref('71123456 / 98765432'), 'tel:+21671123456'); // importers.phone VARCHAR(20) holding two numbers
  assert.equal(telHref('+216 71 123 456'), 'tel:+21671123456');
  assert.equal(telHref('26 898 989 ou 98 765 432'), 'tel:+21626898989');
  assert.equal(telHref('71 123 456 - 98 765 432'), 'tel:+21671123456');
  assert.equal(telHref('+33 1 23 45 67 89'), 'tel:+33123456789');
  assert.equal(telHref(''), null);
  assert.equal(telHref(null), null);
  assert.match(page, /const callHref = telHref\(spec\.importer\?\.phone\);/);
  assert.match(page, /<a href=\{telHref\(importer\.phone\) \|\| undefined\}/); // the importer card too
  assert.doesNotMatch(page, /tel:\$\{(spec\.)?importer\.phone/);
});

test('the capsule keeps the call button and a smaller « Comparer » (40 px pill)', () => {
  assert.match(page, /FloatCall: "ms-capsule-well shrink-0 w-12 h-12 /);
  assert.match(page, /FloatCompare: "shrink-0 h-10 /);
  assert.match(page, /onClick=\{handleCompare\}>\s*<ArrowLeftRight[^>]*className="max-\[359px\]:hidden" \/>\s*Comparer/);
  assert.match(page, /pb-\[calc\(7rem\+env\(safe-area-inset-bottom\)\)\] md:pb-20/);
});

test('material and depth: one light glass, tinted wells on it, a scroll edge under it', () => {
  const capsule = css.match(/\.ms-capsule \{[^}]*\}/)?.[0] || '';
  assert.match(capsule, /background: rgba\(255, 255, 255, 0\.62\);/);
  assert.match(capsule, /backdrop-filter: blur\(28px\) saturate\(1\.9\);/);
  assert.match(capsule, /inset 0 1px 0 rgba\(255, 255, 255, 0\.95\)/); // light on the top edge
  assert.match(capsule, /inset 0 -1px 0 rgba\(15, 18, 24, 0\.05\)/); // thickness
  assert.match(capsule, /animation: ms-capsule-in /); // materializes once
  assert.match(css, /@keyframes ms-capsule-in \{\s*from \{[^}]*backdrop-filter: blur\(0\) saturate\(1\);/);
  // never light glass on light glass: the price and the call button are tinted wells
  assert.match(css, /\.ms-capsule-well \{ background: rgba\(15, 18, 24, 0\.045\); \}/);
  assert.match(page, /FloatPrice: "ms-capsule-well /);
  assert.match(page, /FloatCall: "ms-capsule-well /);
  assert.doesNotMatch(page, /bg-white\/60/);
  // the page dissolves under the capsule
  assert.match(page, /FloatEdge: "ms-capsule-edge lg:hidden fixed inset-x-0 bottom-0 z-40 /);
  assert.match(page, /<div className=\{S\.FloatEdge\} aria-hidden="true" \/>/);
  // accessibility settings
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\) \{\s*\.ms-capsule \{ background: #fff;/);
  assert.match(css, /@media \(prefers-contrast: more\) \{\s*\.ms-capsule \{ background: #fff; box-shadow: 0 0 0 1\.5px #161a22/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.ms-capsule \{ animation: ms-fade-in /);
  // small text over the glass: heavier and a little more tracking
  assert.match(page, /font-semibold text-gray-700 leading-tight tracking-\[0\.02em\] whitespace-nowrap truncate">\{capsule\.sub\}/);
});
