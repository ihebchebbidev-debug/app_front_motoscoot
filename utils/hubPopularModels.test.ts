import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickHubModels, HUB_MODELS_HEADING, HUB_MODELS_MAX } from './techSpecsHubSeo';
import { renderHubHtml } from '../api/og-prerender';

// SEO audit of /fiches-techniques (2026-11-19), P3: « Modèles populaires »,
// links from the hub to the fiches (the pages that rank). The site counts
// visits per brand, not per model: one model per brand, in the order of
// /api/tech-specs/popular (most visited brands first, newest model first).

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const IMG = 'https://www.moto-scoot.tn/uploads/x.webp';
type Row = { id: string; slug: string; brand: string; model: string; price_new: string | null; image: string | null; engine: { cc: string } };
const row = (brand: string, model: string, price: string | null, image: string | null = IMG): Row =>
  ({ id: `${brand}-${model}`, slug: `${brand}-${model}`.toLowerCase().replace(/\s+/g, '-'), brand, model, price_new: price, image, engine: { cc: '125 cc' } });
const src = (r: Row) => ({ brand: r.brand, image: r.image, price: r.price_new });

// Order of /popular on 2026-11-19 (SYM first: 9 SYM models before any Peugeot).
const POPULAR = [
  row('SYM', 'Jet 14 EVO 125', '9000'), row('SYM', 'ADXTG 400', 'En arrivage'), row('SYM', 'Jet X 125', '9399'),
  row('Peugeot', 'Pulsion 125', '12900'), row('Peugeot', 'Django 125', '10900'),
  row('Zontes', '125 X', 'En arrivage'), row('Zontes', '368G', '18900'),
  row('Kymco', 'Agility S 125', 'Prochainement'),
  row('Teyin', 'Shadow 125', '6900', null), row('Teyin', 'Rider 125', null),
  row('Autre', 'X', '1000'),
];

test('one model per brand, most visited brands first', () => {
  const picked = pickHubModels(POPULAR, src).map((r) => `${r.brand} ${r.model}`);
  assert.deepEqual(picked, ['SYM Jet 14 EVO 125', 'Peugeot Pulsion 125', 'Zontes 368G', 'Kymco Agility S 125', 'Teyin Rider 125']);
});

test('a model with a price in DT is preferred; never one without a photo; at most 12', () => {
  const picked = pickHubModels(POPULAR, src);
  assert.equal(picked.find((r) => r.brand === 'Zontes')!.model, '368G', 'priced model before « En arrivage »');
  assert.equal(picked.find((r) => r.brand === 'Kymco')!.model, 'Agility S 125', 'no priced model: the first one');
  assert.ok(picked.every((r) => r.image), 'the card needs a photo');
  assert.ok(!picked.some((r) => r.brand === 'Autre'));
  const many = Array.from({ length: 20 }, (_, i) => row(`Marque ${i}`, 'M', '5000'));
  assert.equal(pickHubModels(many, src).length, HUB_MODELS_MAX);
  assert.equal(HUB_MODELS_MAX, 12);
});

test('the HTML Google receives links the same models, with cylinder and price', () => {
  const html = renderHubHtml([{ brand: 'SYM', modelsCount: 3 }, { brand: 'Peugeot', modelsCount: 2 }], new Date('2026-11-19'), POPULAR as any);
  assert.match(html, new RegExp(`<h2>${HUB_MODELS_HEADING}</h2>`));
  assert.match(html, /<li><a href="https:\/\/www\.moto-scoot\.tn\/fiche-technique\/sym-jet-14-evo-125">SYM Jet 14 EVO 125<\/a> : 125 cc · 9[\s  ]000 DT<\/li>/);
  assert.match(html, /<a href="https:\/\/www\.moto-scoot\.tn\/fiche-technique\/peugeot-pulsion-125">Peugeot Pulsion 125<\/a>/);
  assert.doesNotMatch(html, /Jet X 125/, 'one model per brand');
  // API down for /popular: no empty section, the page keeps its brands.
  const without = renderHubHtml([{ brand: 'SYM', modelsCount: 3 }], new Date('2026-11-19'), []);
  assert.doesNotMatch(without, /Modèles populaires/);
  assert.match(without, /\/fiches-techniques\/sym/);
});

test('the React page shows the row with the shared card, outside search and filters', () => {
  const page = read('../components/TechSpecsBrands.tsx');
  assert.match(page, /\{showPopular && popularModels\.length > 0 && \(\s*<ModelCarousel\s+id="modeles-populaires"\s+heading=\{HUB_MODELS_HEADING\}/);
  assert.match(page, /useHubPopularModels\(!isLoading\)/);
  assert.match(read('../hooks/useTechSpecs.ts'), /pickHubModels\(specs, \(s\) => \(\{ brand: s\.brand, image: s\.image, price: s\.priceNew \}\)\)/);
  // The fiche page keeps its « Modèles similaires » row, now the shared carousel.
  assert.match(read('../components/TechSpecsDetails.tsx'), /<ModelCarousel id="modeles-similaires" heading=\{SIMILAR_MODELS_HEADING\} models=\{similar\} \/>/);
  assert.match(read('../components/tech-specs/ModelCarousel.tsx'), /<TechSpecModelCard spec=\{m\} \/>/);
});
