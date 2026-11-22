import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { techSpecVersions, type TechSpecVersionSource } from './techSpecSeo';
import { renderFicheBody } from '../api/og-prerender';

// Owner, 2026-11-22: « sym jet 14 » (553 impressions, 7th) reached the EVO
// sheet while Google's first results show the Jet 14 AC E5. Each Jet 14 sheet
// now lists its versions, with links and what tells them apart.

const evo: TechSpecVersionSource = { id: 'e', slug: 'sym-jet-14-evo-125', brand: 'SYM', model: 'Jet 14 EVO 125', category: 'Scooter', price: '9000', power: '12,6 ch', fuelSystem: 'Injection électronique', weight: '136 kg' };
const acE5: TechSpecVersionSource = { id: 'a', slug: 'sym-jet-14-125-ac-e5', brand: 'SYM', model: 'Jet 14 125 AC E5', category: 'Scooter', price: '8700', power: '10,2 ch (7,5 kW)', fuelSystem: 'Injection électronique', weight: '128 kg' };
const carbu: TechSpecVersionSource = { id: 'c', slug: 'sym-jet-14-125-carburateur', brand: 'SYM', model: 'Jet 14 125 carburateur', category: 'Scooter', price: '7099', power: '8,8 ch', fuelSystem: 'Carburateur', weight: '' };
const others: TechSpecVersionSource[] = [
  { id: 'x', slug: 'sym-jet-x-125', brand: 'SYM', model: 'Jet X 125', category: 'Scooter', price: '9399' },
  { id: 'r', slug: 'sym-jet-4-rx-125', brand: 'SYM', model: 'Jet 4 RX 125', category: 'Scooter', price: '6900' },
  { id: 'z', slug: 'zontes-jet-14', brand: 'Zontes', model: 'Jet 14', category: 'Scooter', price: '1' },
];

test('the three Jet 14 sheets list each other, cheapest first, the current one without a link', () => {
  const v = techSpecVersions(evo, [acE5, carbu, evo, ...others])!;
  assert.equal(v.heading, 'Les versions du SYM Jet 14');
  assert.deepEqual(v.rows.map((r) => [r.name, r.href]), [
    ['SYM Jet 14 125 carburateur', '/fiche-technique/sym-jet-14-125-carburateur'],
    ['SYM Jet 14 125 AC E5', '/fiche-technique/sym-jet-14-125-ac-e5'],
    ['SYM Jet 14 EVO 125', null],
  ]);
  // No brakes column (owner, 2026-11-22).
  assert.deepEqual(v.columns, ['price', 'fuel', 'power', 'weight']);
  assert.equal(v.rows[1].price, '8 700 DT');
  assert.ok(!('brakes' in v.rows[1]));
  assert.equal(v.rows[1].power, '10,2 ch');
  assert.equal(v.rows[0].weight, '');
});

test('Jet X, Jet 4 RX and another brand are not versions of the Jet 14', () => {
  const v = techSpecVersions(acE5, [evo, carbu, ...others])!;
  assert.equal(v.rows.length, 3);
  assert.ok(!v.rows.some((r) => /Jet X|Jet 4|Zontes/.test(r.name)));
});

test('same two words but another category is another motorcycle (BMW F 900 R / F 900 GS)', () => {
  const r = { slug: 'bmw-f-900-r', brand: 'BMW Motorrad', model: 'F 900 R', category: 'Roadster', price: '40000' };
  const gs = { slug: 'bmw-f-900-gs', brand: 'BMW Motorrad', model: 'F 900 GS', category: 'Trail', price: '50000' };
  assert.equal(techSpecVersions(r, [gs]), null);
});

test('a model with no other version has no block', () => {
  assert.equal(techSpecVersions(others[0], [evo, acE5, carbu, others[0]]), null);
  assert.equal(techSpecVersions({ brand: 'SYM', model: '' }, [evo]), null);
});

test('a motorcycle reads « de la », empty columns are left out', () => {
  const a = { slug: 'yamaha-mt-07', brand: 'Yamaha', model: 'MT-07', category: 'Roadster', price: '35000' };
  const b = { slug: 'yamaha-mt-07-y-amt', brand: 'Yamaha', model: 'MT-07', category: 'Roadster', price: '38000' };
  const v = techSpecVersions(a, [b])!;
  assert.equal(v.heading, 'Les versions de la Yamaha MT-07');
  assert.deepEqual(v.columns, ['price']);
});

test('the crawler HTML shows the table under « Caractéristiques », with links to the other versions', () => {
  const versions = techSpecVersions(evo, [acE5, carbu])!;
  const html = renderFicheBody({ brand: 'SYM', model: 'Jet 14 EVO 125', category: 'Scooter', price_new: '9000', engine: { cc: '125 cc' } } as any, [], versions);
  assert.match(html, /<h2>Les versions du SYM Jet 14<\/h2>/);
  assert.match(html, /<a href="\/fiche-technique\/sym-jet-14-125-ac-e5">SYM Jet 14 125 AC E5<\/a>/);
  assert.match(html, /<strong>SYM Jet 14 EVO 125<\/strong>/);
  // Owner, 2026-11-22: the versions go under the « Caractéristiques » table.
  assert.ok(html.indexOf('Prix neuf en Tunisie') < html.indexOf('<h2>Caractéristiques</h2>') && html.indexOf('<h2>Caractéristiques</h2>') < html.indexOf('Les versions du'));
  assert.doesNotMatch(renderFicheBody({ brand: 'SYM', model: 'Jet X 125' } as any), /Les versions/);
});

test('the page uses the same rule and catalogue as the crawler HTML', () => {
  const page = readFileSync(new URL('../components/TechSpecsDetails.tsx', import.meta.url), 'utf8');
  assert.match(page, /return techSpecVersions\(source\(spec\), catalogue\.map\(source\)\);/);
  assert.match(page, /<h2 id="versions-modele"[^>]*>\s*\{versions\.heading\}/);
  // Same order on the page: under « Caractéristiques », before the similar models.
  assert.ok(page.indexOf('Caractéristiques\n') < page.indexOf('id="versions-modele"') && page.indexOf('id="versions-modele"') < page.indexOf('<ModelCarousel id="modeles-similaires"'));
  const api = readFileSync(new URL('../api/og-prerender.ts', import.meta.url), 'utf8');
  assert.match(api, /versions: techSpecVersions\(versionSource\(d\), catalogue\.map\(versionSource\)\)/);
});
