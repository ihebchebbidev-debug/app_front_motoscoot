import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { techSpecFaq, faqFreeText, TECH_SPEC_FAQ_HEADING } from './techSpecSeo';
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

test('warranty and servicing from « Garantie & Entretien », before « où acheter » (owner, 2026-11-22)', () => {
  const faq = techSpecFaq({ ...lmAdv, warranty: '1 Ans', firstService: '1000 KM', serviceInterval: 'Tous les 4000 KM' });
  const q = faq.map((f) => f.question);
  assert.deepEqual(q.slice(-3), [
    'Quelle est la garantie du Teyin LM ADV 125 ?',
    'Quand faire la révision du Teyin LM ADV 125 ?',
    'Où acheter le Teyin LM ADV 125 en Tunisie ?',
  ]);
  assert.equal(faq.at(-3)!.answer, 'Garantie constructeur annoncée : 1 an.');
  assert.equal(faq.at(-2)!.answer, 'Première révision : 1\u00a0000\u00a0km. Révisions suivantes : tous les 4\u00a0000\u00a0km.');
  const bmw = techSpecFaq({ brand: 'BMW Motorrad', model: 'F 900 R', category: 'Roadster', warranty: '3 ans en France.', firstService: 'Entre 500 et 1 200 km.' });
  assert.equal(bmw[0].question, 'Quelle est la garantie de la BMW Motorrad F 900 R ?');
  assert.equal(bmw[1].answer, 'Première révision : entre 500 et 1 200\u00a0km.');
  // Missing values: no question; one of the two servicing values is enough.
  assert.ok(!techSpecFaq({ brand: 'SYM', model: 'X', category: 'Scooter', warranty: '  ' }).length);
  assert.equal(techSpecFaq({ brand: 'SYM', model: 'X', category: 'Scooter', serviceInterval: '6000 km' })[0].answer, 'Révisions suivantes : 6\u00a0000\u00a0km.');
});

test('colours, as typed in the admin, before « où acheter » (owner, 2026-11-22)', () => {
  const faq = techSpecFaq({ ...lmAdv, colors: ['Blanc', 'Noir mat', 'Bleu'] });
  assert.deepEqual(faq.at(-2), {
    question: 'Quelles sont les couleurs du Teyin LM ADV 125 ?',
    answer: 'Le Teyin LM ADV 125 est proposé en 3 couleurs : Blanc, Noir mat et Bleu.',
  });
  assert.equal(techSpecFaq({ brand: 'Yamaha', model: 'MT-07', category: 'Roadster', colors: ['Icon Blue'] })[0].answer,
    'La Yamaha MT-07 est proposée en une couleur : Icon Blue.');
  assert.ok(!techSpecFaq({ ...lmAdv, colors: [' ', ''] }).some((f) => /couleurs/.test(f.question)));
});

test('admin free text is tidied, never rewritten', () => {
  assert.equal(faqFreeText('Honda France, 5 ans jusqu’au 31 mars 2025.'), 'Honda France, 5 ans jusqu’au 31 mars 2025');
  assert.equal(faqFreeText('6 Mois'), '6 mois');
  assert.equal(faqFreeText('Tout les 4000 Km'), 'tous les 4\u00a0000\u00a0km');
  assert.equal(faqFreeText('1 h de fonctionnement'), '1 h de fonctionnement');
  assert.equal(faqFreeText(null), '');
});

test('the crawler HTML carries the same questions as the page', () => {
  const html = renderFicheBody({
    brand: 'Teyin', model: 'LM ADV 125', category: 'Scooter / Adventure (ADV)', price_new: '10350',
    updated_at: '2026-11-03T10:00:00Z', top_speed: '95 km/h', consumption: '2.8 L/100km',
    engine: { cc: '124.6 cc', power: '9.2 ch' }, dimensions: { tank: '7 L', weight: '128 kg' },
    available_in_tunisia: true, importer: { name: 'Teyin Tunisie', city: 'Sfax' },
    maintenance: { warranty: '1 Ans', firstService: '1000 KM', serviceInterval: '' },
    colors: ['Blanc', 'Gris'],
  } as any);
  assert.match(html, new RegExp(`<h2>${TECH_SPEC_FAQ_HEADING}</h2>`));
  assert.match(html, /<h3>Quelle est la vitesse maximale du Teyin LM ADV 125 \?<\/h3>\n<p>Sa vitesse maximale annoncée est de 95 km\/h\.<\/p>/);
  assert.match(html, /<h3>Quelle est la garantie du Teyin LM ADV 125 \?<\/h3>\n<p>Garantie constructeur annoncée : 1 an\.<\/p>/);
  // Same « Garantie & Entretien » rows as the page's table.
  assert.match(html, /<tr><th scope="row">Garantie constructeur<\/th><td>1 Ans<\/td><\/tr>/);
  assert.match(html, /<tr><th scope="row">Couleurs disponibles<\/th><td>Blanc, Gris<\/td><\/tr>/);
  assert.match(html, /<h3>Quelles sont les couleurs du Teyin LM ADV 125 \?<\/h3>\n<p>Le Teyin LM ADV 125 est proposé en 2 couleurs : Blanc et Gris\.<\/p>/);
  // After the similar models, before the summary sentence.
  assert.ok(html.indexOf(TECH_SPEC_FAQ_HEADING) < html.indexOf('Teyin LM ADV 125 : '));
});

test('the page renders the shared FAQ with real headings, visible to every visitor', () => {
  const page = readFileSync(new URL('../components/TechSpecsDetails.tsx', import.meta.url), 'utf8');
  assert.match(page, /const faq = techSpecFaq\(\{/);
  assert.match(page, /warranty: spec\.maintenance\?\.warranty, firstService: spec\.maintenance\?\.firstService, serviceInterval: spec\.maintenance\?\.serviceInterval/);
  assert.match(page, /colors: spec\.colors,/);
  assert.match(page, /<SpecRow label="Couleurs disponibles" value=\{spec\.colors\.join\(', '\)\} \/>/);
  assert.match(page, /<h2 id="questions-frequentes"[^>]*>\s*\{TECH_SPEC_FAQ_HEADING\}/);
  assert.match(page, /<h3 [^>]*>\{f\.question\}<\/h3>/);
  // Visible text, not a hidden keyword block.
  assert.doesNotMatch(page, /questions-frequentes[\s\S]{0,400}(sr-only|hidden)/);
});
