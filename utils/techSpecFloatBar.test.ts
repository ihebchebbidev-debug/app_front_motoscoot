import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { capsulePrice } from './capsulePrice';
import { telHref } from './phoneUtils';

const page = readFileSync(new URL('../components/TechSpecsDetails.tsx', import.meta.url), 'utf8');
const NNBSP = ' '; // what fmtPrice's toLocaleString('fr-FR') puts between thousands

test('fiche, phones: a floating white frosted capsule, not a bar glued to the edges', () => {
  assert.doesNotMatch(page, /fixed bottom-0 left-0 right-0/);
  assert.match(page, /FloatBar: "lg:hidden fixed z-50 left-3 right-3 bottom-\[calc\(0\.75rem\+env\(safe-area-inset-bottom\)\)\] mx-auto max-w-md h-14 p-1 /);
  assert.match(page, /rounded-full bg-white\/65 backdrop-blur-2xl backdrop-saturate-\[1\.8\]/);
  assert.match(page, /\[@media\(prefers-reduced-transparency:reduce\)\]:bg-white /); // solid when asked
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
  assert.match(page, /FloatCall: "shrink-0 w-12 h-12 /);
  assert.match(page, /FloatCompare: "shrink-0 h-10 /);
  assert.match(page, /onClick=\{handleCompare\}>\s*<ArrowLeftRight[^>]*className="max-\[359px\]:hidden" \/>\s*Comparer/);
  assert.match(page, /pb-\[calc\(7rem\+env\(safe-area-inset-bottom\)\)\] md:pb-20/);
});
