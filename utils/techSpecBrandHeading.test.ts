import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brandPageH1, brandSummaryParts, brandSummaryText } from './techSpecBrandHeading';

const NBSP = String.fromCharCode(0xa0);
const sp = (s: string) => s.replace(/ /g, NBSP);
const page = readFileSync(new URL('../components/TechSpecsModels.tsx', import.meta.url), 'utf8');
const hero = readFileSync(new URL('../components/tech-specs/TechSpecsHero.tsx', import.meta.url), 'utf8');
const bar = readFileSync(new URL('../components/ui/FilterBar.tsx', import.meta.url), 'utf8');
const prerender = readFileSync(new URL('../api/og-prerender.ts', import.meta.url), 'utf8');

test('brand title says what people search, on one line', () => {
  assert.equal(brandPageH1('SYM'), 'Prix SYM en Tunisie');
});

test('summary: count, price range, cylinder range', () => {
  const sym = [
    { price: '9 000 DT', cc: '124.7 cc' }, { price: '24000 DT', cc: '278 cc' }, { price: 'En arrivage', cc: '399 cc' },
    { price: '5850 DT', cc: '124.6 CC' },
  ];
  assert.deepEqual(brandSummaryParts(sym), [sp('4 modèles'), `5${NBSP}850 à 24${NBSP}000${NBSP}DT`, `125 à 399${NBSP}cm³`]);
  assert.equal(brandSummaryText(sym).split(' · ').length, 3);
});

test('summary edge cases: one model, one price, no price', () => {
  assert.deepEqual(brandSummaryParts([{ price: '6 300 DT', cc: '124.6 cm³' }]), [sp('1 modèle'), `6${NBSP}300${NBSP}DT`, `125${NBSP}cm³`]);
  assert.deepEqual(brandSummaryParts([{ price: 'En arrivage', cc: '' }, { price: 'Prochainement', cc: null }]), [sp('2 modèles')]);
});

test('the crawler HTML and the page say the same title and summary', () => {
  assert.match(prerender, /import \{ brandPageH1, brandSummaryText \} from '\.\.\/utils\/techSpecBrandHeading\.js';/);
  assert.match(prerender, /<h1>\$\{escapeHtml\(brandPageH1\(brand\)\)\}<\/h1>\n<p>\$\{escapeHtml\(summary\)\}<\/p>/);
  assert.doesNotMatch(prerender, /<h1>Fiches techniques \$\{/);
  assert.match(page, /title=\{brandPageH1\(brandName\)\}/);
  assert.match(page, /brandSummaryParts\(brandModels\.map/);
});

test('phone top: 24 px title without slide-in, one sticky row, status only when something changed', () => {
  assert.match(hero, /MainTitleStandard: "max-w-4xl text-2xl leading-tight font-extrabold/);
  assert.doesNotMatch(hero, /<Reveal animation="fade-in-up" delay=\{100\}>/);
  assert.match(page, /titleSize="standard"/);
  assert.match(bar, /md:hidden sticky top-\[calc\(3\.5rem\+var\(--admin-bar-h,0px\)\)\] z-30/);
  assert.match(bar, /aria-label=\{filtersLabel\}/); // « Filtres, 2 actifs »
  assert.match(page, /className=\{changed \? 'flex flex-wrap/);
  assert.match(page, /searchPlaceholder="Rechercher"\s+searchLabel=\{`Rechercher un modèle \$\{brandName\}`\}/);
});
