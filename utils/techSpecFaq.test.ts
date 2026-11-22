import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { techSpecFaq, TECH_SPEC_FAQ_HEADING } from './techSpecSeo';
import { renderFicheBody } from '../api/og-prerender';

// Owner, 2026-11-22: a « Questions fréquentes » block on every technical sheet,
// written from the fields already filled in the admin. Search Console (3
// months, fiches): « prix » 27 % of impressions, « vitesse max » 2,6 % with
// 1,3 % CTR, « fiche technique / puissance / poids », « consommation ».

const lmAdv = {
  brand: 'Teyin', model: 'LM ADV 125', category: 'Scooter / Adventure (ADV)', price: '10350',
  updatedAt: '2026-11-03T10:00:00Z', topSpeed: '95 km/h', consumption: '2.8 L/100km', tank: '7 L',
  cc: '124.6 cc', power: '9.2 ch', weight: '128 kg', availableInTunisia: true,
  importerName: 'Teyin Tunisie', importerCity: 'Sfax',
};

test('a complete scooter sheet answers price, speed, consumption, range, engine, weight and where to buy', () => {
  const faq = techSpecFaq(lmAdv);
  assert.deepEqual(faq.map((f) => f.question), [
    'Quel est le prix du Teyin LM ADV 125 en Tunisie ?',
    'Quelle est la vitesse maximale du Teyin LM ADV 125 ?',
    'Combien consomme le Teyin LM ADV 125 ?',
    'Quelle est l’autonomie du Teyin LM ADV 125 ?',
    'Quelle est la cylindrée du Teyin LM ADV 125 ?',
    'Combien pèse le Teyin LM ADV 125 ?',
    'Où acheter le Teyin LM ADV 125 en Tunisie ?',
  ]);
  assert.equal(faq[0].answer, 'Le Teyin LM ADV 125 est affiché à 10\u00a0350\u00a0DT TTC en Tunisie, prix du neuf relevé en novembre 2026.');
  assert.equal(faq[1].answer, 'Sa vitesse maximale annoncée est de 95 km/h.');
  assert.equal(faq[2].answer, 'Sa consommation annoncée est de 2,8 L/100 km.');
  // 7 L / 2,8 L/100 km = 250 km, rounded to 10 km and called « théorique ».
  assert.equal(faq[3].answer, 'Avec un réservoir de 7 L et une consommation de 2,8 L/100 km, son autonomie théorique est d’environ 250 km.');
  assert.equal(faq[4].answer, 'Le Teyin LM ADV 125 a un moteur de 124,6 cm³ qui développe 9,2 ch.');
  assert.equal(faq[5].answer, 'Son poids annoncé est de 128 kg.');
  assert.equal(faq[6].answer, 'Le Teyin LM ADV 125 est distribué en Tunisie par Teyin Tunisie, basé à Sfax.');
});

test('a motorcycle reads « la » / « de la »', () => {
  const faq = techSpecFaq({ brand: 'Yamaha', model: 'MT-07', category: 'Roadster', price: '35 000 DT', topSpeed: '214 km/h' });
  assert.equal(faq[0].question, 'Quel est le prix de la Yamaha MT-07 en Tunisie ?');
  assert.equal(faq[0].answer, 'La Yamaha MT-07 est affichée à 35\u00a0000\u00a0DT TTC en Tunisie, prix du neuf.');
  assert.equal(faq[1].question, 'Quelle est la vitesse maximale de la Yamaha MT-07 ?');
});

test('nothing is invented: a missing value drops its question', () => {
  const faq = techSpecFaq({ brand: 'SYM', model: 'NHX 125', category: 'Scooter', price: 'Sur demande' });
  assert.deepEqual(faq, []);
  const arrivage = techSpecFaq({ brand: 'SYM', model: 'Orbit 2 125', category: 'Scooter', price: 'En arrivage' });
  assert.equal(arrivage[0].answer, 'Le SYM Orbit 2 125 est annoncé en arrivage en Tunisie : son prix n’est pas encore connu.');
  // Range needs both the tank and the consumption.
  assert.ok(!techSpecFaq({ brand: 'SYM', model: 'X', category: 'Scooter', tank: '6 L' }).some((f) => /autonomie/.test(f.question)));
  const notSold = techSpecFaq({ brand: 'Honda', model: 'PCX 160', category: 'Scooter', availableInTunisia: false });
  assert.deepEqual(notSold, [{ question: 'Le Honda PCX 160 est-il vendu en Tunisie ?', answer: 'Ce modèle n’est pas commercialisé en Tunisie à ce jour.' }]);
});

test('the crawler HTML carries the same questions as the page', () => {
  const html = renderFicheBody({
    brand: 'Teyin', model: 'LM ADV 125', category: 'Scooter / Adventure (ADV)', price_new: '10350',
    updated_at: '2026-11-03T10:00:00Z', top_speed: '95 km/h', consumption: '2.8 L/100km',
    engine: { cc: '124.6 cc', power: '9.2 ch' }, dimensions: { tank: '7 L', weight: '128 kg' },
    available_in_tunisia: true, importer: { name: 'Teyin Tunisie', city: 'Sfax' },
  } as any);
  assert.match(html, new RegExp(`<h2>${TECH_SPEC_FAQ_HEADING}</h2>`));
  assert.match(html, /<h3>Quelle est la vitesse maximale du Teyin LM ADV 125 \?<\/h3>\n<p>Sa vitesse maximale annoncée est de 95 km\/h\.<\/p>/);
  // After the similar models, before the summary sentence.
  assert.ok(html.indexOf(TECH_SPEC_FAQ_HEADING) < html.indexOf('Teyin LM ADV 125 : '));
});

test('the page renders the shared FAQ with real headings, visible to every visitor', () => {
  const page = readFileSync(new URL('../components/TechSpecsDetails.tsx', import.meta.url), 'utf8');
  assert.match(page, /const faq = techSpecFaq\(\{/);
  assert.match(page, /<h2 id="questions-frequentes"[^>]*>\s*\{TECH_SPEC_FAQ_HEADING\}/);
  assert.match(page, /<h3 [^>]*>\{f\.question\}<\/h3>/);
  // Visible text, not a hidden keyword block.
  assert.doesNotMatch(page, /questions-frequentes[\s\S]{0,400}(sr-only|hidden)/);
});
