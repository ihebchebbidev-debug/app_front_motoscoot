import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scooter125Rows, scooter125SourceFromApi, scooter125Intro, scooter125Faq, scooter125Bands, parseDtPrice } from './scooter125Guide';
import { isKnownPagePath } from './knownPages';
import detailHandler from '../api/og-prerender';

function responseCapture() {
  return { code: 0, headers: {} as Record<string, string>, body: '', setHeader(key: string, value: string) { this.headers[key] = value; return this; }, status(code: number) { this.code = code; return this; }, send(body: string) { this.body = body; return this; }, end() { return this; } };
}

const API_DOCS = [
  { id: 'a', slug: 'sym-jet-14-evo-125', brand: 'SYM', model: 'Jet 14 EVO 125', year: 2026, category: 'Scooter', price_new: '9000', engine: { cc: '124.7 cc', power: '12.6 ch' }, dimensions: { weight: '136 kg' }, importer: { name: 'Megacycle' }, available_in_tunisia: true },
  { id: 'b', slug: 'peugeot-django-125', brand: 'Peugeot', model: 'Django 125', year: 2025, category: 'Scooter', price_new: '10 900', engine: { cc: '125 cc', power: '10.6 ch' }, dimensions: { weight: '135 kg' }, importer: { name: 'SIMCC' }, available_in_tunisia: true },
  { id: 'c', slug: 'sym-jet-x-125', brand: 'SYM', model: 'Jet X 125', year: 2025, category: 'Scooter', price_new: 9399, engine: { cc: '125 cc', power: '9.3 kW (12.6 ch) à 8000 tr/min' }, dimensions: { weight: '140 kg' }, available_in_tunisia: true },
  { id: 'd', slug: 'teyin-lm-la-vita-125', brand: 'Teyin', model: 'LM LA VITA 125', year: 2026, category: 'Scooter', price_new: '5999', engine: { cc: '125 cc', power: '12.5 ch' }, dimensions: { weight: '142 Kg' }, available_in_tunisia: true },
  // Left out: too big, not a scooter, no price yet, not sold in Tunisia.
  { id: 'e', slug: 'sym-adx-300', brand: 'SYM', model: 'ADX 300', category: 'Scooter', price_new: '24000', engine: { cc: '278 cc' }, available_in_tunisia: true },
  { id: 'f', slug: 'peugeot-pm-01', brand: 'Peugeot', model: 'PM-01', category: 'Roadster', price_new: '11 500', engine: { cc: '124.8 cc' }, available_in_tunisia: true },
  { id: 'g', slug: 'qj-motor-sq16-125', brand: 'QJ Motor', model: 'SQ16 125', category: 'Scooter', price_new: 'En arrivage', engine: { cc: '125 cc' }, available_in_tunisia: true },
  { id: 'h', slug: 'honda-sh-125', brand: 'Honda', model: 'SH 125', category: 'Scooter', price_new: '15000', engine: { cc: '125 cc' }, available_in_tunisia: false },
];

test('price guide lists only priced scooters of 125 cm³ or less sold in Tunisia, cheapest first', () => {
  const rows = scooter125Rows(API_DOCS.map(scooter125SourceFromApi));
  assert.deepEqual(rows.map((r) => r.slug), ['teyin-lm-la-vita-125', 'sym-jet-14-evo-125', 'sym-jet-x-125', 'peugeot-django-125']);
  assert.equal(rows[3].price, 10900);
  assert.equal(rows[2].powerCh, 12.6);
  assert.equal(rows[0].weightKg, 142);
  assert.equal(rows[1].importer, 'Megacycle');
});

test('formatted and free-text prices: numbers kept, "En arrivage" and "Sur demande" dropped', () => {
  assert.equal(parseDtPrice('9 000 DT'), 9000);
  assert.equal(parseDtPrice(`10${' '}900 DT`), 10900);
  assert.equal(parseDtPrice('En arrivage'), null);
  assert.equal(parseDtPrice('Sur demande'), null);
  assert.equal(parseDtPrice('—'), null);
});

test('intro, bands and FAQ are written from the rows (no hardcoded model or price)', () => {
  const rows = scooter125Rows(API_DOCS.map(scooter125SourceFromApi));
  const now = new Date(2026, 10, 2);
  const intro = scooter125Intro(rows, now);
  assert.ok(intro.startsWith('Au 2 novembre 2026, un scooter 125 neuf coûte de '));
  assert.ok(intro.includes('Teyin LM LA VITA 125') && intro.includes('Peugeot Django 125') && intro.includes('4 modèles'));
  const bands = scooter125Bands(rows);
  assert.deepEqual(bands.map((b) => b.rows.length), [1, 2, 1]);
  const faq = scooter125Faq(rows);
  assert.equal(faq[0].question, 'Quel est le scooter 125 le moins cher en Tunisie ?');
  assert.ok(faq[0].answer.includes('Teyin LM LA VITA 125'));
});

test('crawler HTML for /prix/scooter-125-tunisie: canonical, one h1, the price table and an ItemList', async () => {
  const original = globalThis.fetch;
  const requested: string[] = [];
  try {
    globalThis.fetch = async (input: any) => {
      const url = String(input);
      requested.push(url);
      if (/\/tech-specs\/brands\?/.test(url)) return Response.json([{ brand: 'SYM' }, { brand: 'Peugeot' }, { brand: 'Teyin' }]);
      const brand = decodeURIComponent(url.match(/\/tech-specs\/brands\/([^?]+)/)?.[1] || '');
      return Response.json(API_DOCS.filter((d) => d.brand === brand));
    };
    const result = responseCapture();
    await detailHandler({ query: { kind: 'prix', slugid: 'scooter-125-tunisie' }, appShell: '<html><head><title>x</title></head><body><div id="root"></div><script src="app.js"></script></body></html>' }, result);
    assert.equal(result.code, 200);
    assert.ok(requested.every((u) => u.includes('available_in_tunisia=true')));
    assert.ok(result.body.includes('<link rel="canonical" href="https://www.moto-scoot.tn/prix/scooter-125-tunisie" />'));
    assert.equal(result.body.match(/<h1>/g)?.length, 1);
    assert.equal(result.body.match(/<tr><th scope="row">/g)?.length, 4);
    assert.ok(result.body.includes('href="https://www.moto-scoot.tn/fiche-technique/sym-jet-14-evo-125"'));
    assert.ok(result.body.includes('"@type":"ItemList"'));
    assert.ok(result.body.includes('<script src="app.js"></script>'));
  } finally { globalThis.fetch = original; }
});

test('unknown price guide is a 404 and the guide path is a known page', async () => {
  const result = responseCapture();
  await detailHandler({ query: { kind: 'prix', slugid: 'moto-1000-tunisie' } }, result);
  assert.equal(result.code, 404);
  assert.equal(isKnownPagePath('/prix/scooter-125-tunisie'), true);
});
