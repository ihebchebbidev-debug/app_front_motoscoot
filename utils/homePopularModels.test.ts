import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickPopularModels, POPULAR_MODELS_MAX } from './popularModels';
import { popularModelLinks, linkBlocksFor } from '../src/seo/snapshotLinks';

// Owner, 2026-11-19: « Modèles populaires » goes on the home page, in place of
// the old block (3 cards, all SYM), not on /fiches-techniques. The site counts
// visits per brand, not per model: one model per brand, in the order of
// /api/tech-specs/popular (most visited brands first, newest model first).

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const IMG = 'https://www.moto-scoot.tn/uploads/x.webp';
type Row = { slug: string; brand: string; model: string; price_new: string | null; image: string | null };
const row = (brand: string, model: string, price: string | null, image: string | null = IMG): Row =>
  ({ slug: `${brand}-${model}`.toLowerCase().replace(/\s+/g, '-'), brand, model, price_new: price, image });
const src = (r: Row) => ({ brand: r.brand, image: r.image, price: r.price_new });

// Order of /popular on 2026-11-19 (9 SYM models before any Peugeot).
const POPULAR = [
  row('SYM', 'Jet 14 EVO 125', '9000'), row('SYM', 'ADXTG 400', 'En arrivage'), row('SYM', 'Jet X 125', '9399'),
  row('Peugeot', 'Pulsion 125', '12900'), row('Peugeot', 'Django 125', '10900'),
  row('Zontes', '125 X', 'En arrivage'), row('Zontes', '368G', '18900'),
  row('Kymco', 'Agility S 125', 'Prochainement'),
  row('Teyin', 'Shadow 125', '6900', null), row('Teyin', 'Rider 125', null),
  row('Autre', 'X', '1000'),
];

test('one model per brand, most visited brands first', () => {
  assert.deepEqual(pickPopularModels(POPULAR, src).map((r) => `${r.brand} ${r.model}`),
    ['SYM Jet 14 EVO 125', 'Peugeot Pulsion 125', 'Zontes 368G', 'Kymco Agility S 125', 'Teyin Rider 125']);
});

test('a model with a price in DT is preferred; never one without a photo; at most 12', () => {
  const picked = pickPopularModels(POPULAR, src);
  assert.equal(picked.find((r) => r.brand === 'Zontes')!.model, '368G');
  assert.equal(picked.find((r) => r.brand === 'Kymco')!.model, 'Agility S 125');
  assert.ok(picked.every((r) => r.image));
  assert.ok(!picked.some((r) => r.brand === 'Autre'));
  assert.equal(pickPopularModels(Array.from({ length: 20 }, (_, i) => row(`Marque ${i}`, 'M', '5000')), src).length, POPULAR_MODELS_MAX);
  assert.equal(POPULAR_MODELS_MAX, 12);
});

test('the home HTML links the same fiches, at their short address; not the brands hub', () => {
  assert.deepEqual(popularModelLinks(POPULAR).slice(0, 2), [
    { href: '/fiche-technique/sym-jet-14-evo-125', label: 'SYM Jet 14 EVO 125' },
    { href: '/fiche-technique/peugeot-pulsion-125', label: 'Peugeot Pulsion 125' },
  ]);
  const home = linkBlocksFor('/', { models: POPULAR, brands: ['SYM'] });
  assert.equal(home[0].heading, 'Modèles populaires');
  assert.equal(home[0].links.length, 5);
  assert.ok(!linkBlocksFor('/fiches-techniques', { models: POPULAR, brands: ['SYM'] }).some((b) => b.heading === 'Modèles populaires'));
  assert.ok(!linkBlocksFor('/', { models: [], brands: ['SYM'] }).some((b) => b.heading === 'Modèles populaires'), 'API down: no empty block');
});

test('the home row: shared carousel and card, loaded near the screen; nothing on /fiches-techniques', () => {
  const block = read('../components/PopularModels.tsx');
  assert.match(block, /usePopularModelsRow\(isVisible\)/);
  assert.match(block, /<ModelCarousel\s+id="modeles-populaires"\s+heading=\{POPULAR_MODELS_HEADING\}/);
  assert.match(block, /<Link\s+to=\{getUrlFromState\('tech-specs-brands'\)\}/, '« Voir plus de modèles » is a real link');
  assert.match(read('../config/routes.tsx'), /<PopularBrands onNavigate=\{props\.onNavigate\} \/>\s+<PopularModels onNavigate=\{props\.onNavigate\} \/>/);
  assert.doesNotMatch(read('../components/TechSpecsBrands.tsx'), /ModelCarousel|usePopularModelsRow/);
  assert.match(read('../components/TechSpecsDetails.tsx'), /<ModelCarousel id="modeles-similaires" heading=\{SIMILAR_MODELS_HEADING\} models=\{similar\} \/>/);
});
