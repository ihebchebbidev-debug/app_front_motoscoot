import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HUB_H1, hubDescription, hubPageTitle, hubSummaryParts } from './techSpecsHubSeo';

// SEO audit of /fiches-techniques (2026-11-19), P1: title, description and H1
// say « prix … Tunisie », counts come from the API, no brand outside the
// catalogue (the old description named Suzuki), never more than 160 characters.

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const NBSP = String.fromCharCode(0xa0);

// /api/tech-specs/brands on 2026-11-19: 23 brands, 101 models.
const CATALOGUE = [
  ['Aprilia', 12], ['BMW Motorrad', 1], ['CFMoto', 5], ['Honda', 1], ['KTM', 3], ['Kawasaki', 9], ['Kymco', 3],
  ['Moto Guzzi', 2], ['Motomorini', 8], ['Peugeot', 5], ['Piaggio', 1], ['QJ Motor', 3], ['SLC', 1], ['SMT', 1],
  ['SYM', 9], ['Sanya', 3], ['Teyin', 3], ['Uniscoot', 1], ['Vespa', 9], ['Voge', 3], ['Yamaha', 8], ['Zimota', 6], ['Zontes', 4],
].map(([brand, modelsCount]) => ({ brand: brand as string, modelsCount: modelsCount as number }));

test('title, H1: the price in Tunisia first, fiches techniques kept in the title', () => {
  assert.equal(hubPageTitle(new Date('2026-11-19')), 'Prix des motos et scooters en Tunisie 2026 : fiches techniques');
  assert.equal(HUB_H1, 'Prix des motos et scooters en Tunisie');
});

test('summary under the title: brands and models counted from the API', () => {
  assert.deepEqual(hubSummaryParts(CATALOGUE), [`23${NBSP}marques`, `101${NBSP}modèles`]);
  assert.deepEqual(hubSummaryParts([...CATALOGUE, { brand: 'Autre', modelsCount: 4 }, { brand: 'sym', modelsCount: 9 }]), [`23${NBSP}marques`, `101${NBSP}modèles`]);
  assert.deepEqual(hubSummaryParts([{ brand: 'SYM', modelsCount: null }]), [`1${NBSP}marque`], 'no model count without the numbers');
  assert.deepEqual(hubSummaryParts([]), []);
});

test('description: true counts, only brands of the catalogue, at most 160 characters', () => {
  const d = hubDescription(CATALOGUE);
  assert.ok(d.length <= 160, `${d.length} characters`);
  assert.match(d, /^Prix du neuf et fiches techniques de 101 motos et scooters de 23 marques en Tunisie/);
  assert.match(d, /SYM, Peugeot/);
  assert.doesNotMatch(d, /Suzuki/);
  // A catalogue without Vespa does not name Vespa.
  assert.doesNotMatch(hubDescription(CATALOGUE.filter((r) => r.brand !== 'Vespa')), /Vespa/);
  // API down: a full sentence, no number, no brand.
  const fallback = hubDescription(null);
  assert.ok(fallback.length <= 160);
  assert.doesNotMatch(fallback, /\d|SYM/);
});

test('the React page and the build HTML use these texts', () => {
  const page = read('../components/TechSpecsBrands.tsx');
  assert.match(page, /title=\{hubPageTitle\(\)\}/);
  assert.match(page, /description=\{hubMetaDescription\}/);
  assert.match(page, /title=\{HUB_H1\}/);
  assert.match(page, /summary=\{hubSummary\.length \? hubSummary : undefined\}/);
  const snap = read('../src/seo/snapshots.ts');
  assert.match(snap, /title: `\$\{hubPageTitle\(\)\} \| Moto-Scoot\.tn`/);
  assert.match(snap, /description: hubDescription\(null\)/);
  assert.match(snap, /h1: HUB_H1/);
  assert.doesNotMatch(snap, /Suzuki, Kawasaki, BMW, KTM, Piaggio\. Caract/);
});
