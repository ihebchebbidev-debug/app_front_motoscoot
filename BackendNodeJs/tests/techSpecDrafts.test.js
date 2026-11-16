/**
 * Fiches techniques en brouillon + import d'un lot (admin).
 *
 * Acceptance rules:
 *   1. A draft (is_published = FALSE) never reaches a public endpoint:
 *      brands list, models list, detail page (404), search/popular/latest/
 *      categories/compare, popular brands, importer brand lists, sitemap.
 *   2. Reads keep working when migration 039 has not been run: the filter
 *      reads the column through to_jsonb() and treats "missing" as published.
 *   3. POST /admin/tech-specs/import creates every valid fiche as a draft,
 *      skips (with a French reason) invalid ones, fiches already on the site
 *      and duplicates inside the lot, reuses the brand spelling already on
 *      the site, and drops photos that are not in our /uploads/ pipeline.
 *   4. The import refuses lots over 50 fiches, and answers 503 when the
 *      draft column cannot be created (nothing is published by mistake).
 *   5. The admin form can switch a fiche between draft and published.
 *
 * Only the database module is stubbed: each test records the SQL sent.
 * Runner: node --test tests/techSpecDrafts.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');

const SRC = path.resolve(__dirname, '../src');

let handler = async () => ({ rows: [] });
const calls = [];
const dbMock = {
  query: async (sql, params = []) => { calls.push({ sql, params }); return handler(sql, params); },
  pool: {},
  getClient: async () => { throw new Error('not used'); },
};

const realLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  let resolved;
  try { resolved = Module._resolveFilename(request, parent, isMain); } catch { resolved = request; }
  if (resolved === path.join(SRC, 'config/database.js')) return dbMock;
  if (resolved === path.join(SRC, 'utils/logger.js')) return { info() {}, warn() {}, error() {}, debug() {} };
  return realLoad.apply(this, arguments);
};
const ctrl = require('../src/controllers/techSpecsController');
const extra = require('../src/controllers/techSpecsExtraController');
const drafts = require('../src/utils/techSpecDrafts');
const { normalizeItem, readBatch } = require('../src/utils/techSpecImport');
Module._load = realLoad;

const PUBLISHED_RE = /COALESCE\(\(to_jsonb\(t\)->>'is_published'\)::boolean, TRUE\)/;

function run(fn, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(body) { resolve({ status: this.statusCode, body }); return this; },
    };
    fn({ query: {}, params: {}, body: {}, ...req }, res, (err) => (err ? reject(err) : resolve({ status: 500 })));
  });
}

test.beforeEach(() => { calls.length = 0; handler = async () => ({ rows: [] }); drafts._resetEnsured(); });

/* ---------- 1–2. public reads skip drafts, without needing the column ---------- */

test('brands, models and detail page only read published fiches', async () => {
  await run(ctrl.getBrands, {});
  await run(ctrl.getModels, { params: { brand: 'Yamaha' } });
  const detail = await run(ctrl.getById, { params: { id: 'yamaha-xmax-300' } });
  assert.equal(calls.length, 3);
  for (const c of calls) assert.match(c.sql, PUBLISHED_RE);
  assert.equal(detail.status, 404, 'a draft (no row returned) is a 404 for visitors');
});

test('search, popular, latest, categories and compare only read published fiches', async () => {
  await run(extra.searchAll, { query: { q: 'xmax' } });
  await run(extra.getLatest, { query: {} });
  await run(extra.getCategories, {});
  await run(extra.compare, { body: { ids: ['00000000-0000-0000-0000-000000000001'] } });
  await run(extra.getPopular, { query: {} });
  assert.ok(calls.length >= 5);
  for (const c of calls) assert.match(c.sql, PUBLISHED_RE, c.sql.slice(0, 80));
});

test('sitemap, popular brands, importer brand lists and the Node server skip drafts', () => {
  const files = [
    'src/routes/sitemap.js',
    'src/routes/brands.js',
    'src/controllers/importersController.js',
    '../server.ts',
  ];
  for (const f of files) {
    const code = fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');
    const reads = code.match(/FROM tech_specs(?: \w+)?[\s\S]{0,400}?(?=`)/g) || [];
    assert.ok(reads.length > 0, f);
    for (const r of reads) assert.match(r, /to_jsonb\(\w+\)->>'is_published'/, `${f}: ${r.slice(0, 60)}`);
  }
});

/* ---------- 3. import ---------- */

const fiche = (over = {}) => ({
  brand: 'Yamaha', model: 'XMAX 300', year: 2026, category: 'Scooter',
  engine: { cc: '292 cc', power: '28 ch', bogus: 'x' }, ...over,
});

test('a lot is imported as drafts, with clear reasons for what is skipped', async () => {
  handler = async (sql) => {
    if (/^ALTER TABLE/.test(sql)) return { rows: [] };
    if (/SELECT brand, model, year FROM tech_specs/.test(sql)) {
      return { rows: [{ brand: 'SYM', model: 'Jet 14 EVO 125', year: 2026 }] };
    }
    if (/SELECT ms_slugify/.test(sql)) return { rows: [{ base: 'slug' }] };
    if (/SELECT 1 FROM tech_specs WHERE slug/.test(sql)) return { rows: [] };
    if (/INSERT INTO tech_specs/.test(sql)) return { rows: [{ id: 'new', slug: 'slug' }] };
    throw new Error(`Unexpected query: ${sql.slice(0, 80)}`);
  };
  const r = await run(ctrl.importBatch, {
    body: {
      fiches: [
        fiche(),
        fiche({ brand: 'sym', model: 'Orbit 2 125', image: '/uploads/a.webp' }),
        fiche({ brand: 'Sym', model: 'Jet 14 Evo 125' }),            // already on the site
        fiche(),                                                     // twice in the lot
        fiche({ model: '' }),
        fiche({ model: 'NMAX', image: 'https://www.yamaha-motor.eu/n.jpg', gallery: ['https://x.y/z.jpg'] }),
      ],
    },
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.created.length, 3);
  assert.deepEqual(r.body.skipped.map((s) => s.reason), [
    'Déjà présente sur le site (ou deux fois dans le lot)',
    'Déjà présente sur le site (ou deux fois dans le lot)',
    'Modèle manquant',
  ]);
  assert.equal(r.body.warnings.length, 2, 'external photos are reported');

  const inserts = calls.filter((c) => /INSERT INTO tech_specs/.test(c.sql));
  assert.equal(inserts.length, 3);
  for (const c of inserts) assert.match(c.sql, /is_published\)\s*VALUES \([^)]*,FALSE\)/);
  assert.equal(inserts[1].params[0], 'SYM', 'brand spelling already used on the site');
  assert.equal(inserts[1].params[5], '/uploads/a.webp');
  assert.equal(inserts[2].params[5], null, 'external photo dropped');
  assert.deepEqual(inserts[0].params[7], { cc: '292 cc', power: '28 ch' }, 'unknown keys dropped');
});

test('the import refuses big lots and never publishes when drafts are unavailable', async () => {
  const big = await run(ctrl.importBatch, { body: { fiches: Array.from({ length: 51 }, () => fiche()) } });
  assert.equal(big.status, 400);
  assert.match(big.body.error, /maximum 50/);

  handler = async (sql) => {
    if (/^ALTER TABLE/.test(sql)) throw Object.assign(new Error('permission denied'), { code: '42501' });
    throw new Error('no other query expected');
  };
  const noCol = await run(ctrl.importBatch, { body: [fiche()] });
  assert.equal(noCol.status, 503);
  assert.match(noCol.body.error, /migration 039/);
  assert.equal(calls.filter((c) => /INSERT/.test(c.sql)).length, 0);
});

test('item and lot validation, in French', () => {
  assert.equal(normalizeItem(fiche({ year: 1800 })).error, 'Année invalide (1800)');
  assert.equal(normalizeItem(fiche({ category: ' ' })).error, 'Catégorie manquante');
  assert.equal(normalizeItem('x').error, 'Ce n’est pas une fiche (objet attendu)');
  const ok = normalizeItem(fiche({ image: 'https://www.moto-scoot.tn/uploads/b.webp', price_new: 'Sur demande' }));
  assert.equal(ok.fiche.image, 'https://www.moto-scoot.tn/uploads/b.webp');
  assert.equal(ok.fiche.price_new, 'Sur demande');
  assert.equal(ok.fiche.available_in_tunisia, true);
  assert.match(readBatch({}).error, /liste de fiches/);
  assert.match(readBatch([]).error, /vide/);
});

/* ---------- 5. admin switch ---------- */

test('the admin form switches a fiche between draft and published', async () => {
  handler = async (sql) => (/^UPDATE/.test(sql) ? { rows: [{ id: 'a' }] } : { rows: [] });
  await run(ctrl.update, { params: { id: 'a' }, body: { is_published: true } });
  const up = calls.find((c) => /^UPDATE/.test(c.sql));
  assert.match(up.sql, /is_published = \$1/);
  assert.deepEqual(up.params, [true, 'a']);
});

test('without the column, saving a fiche still works (draft switch ignored)', async () => {
  handler = async (sql) => {
    if (/^ALTER TABLE/.test(sql)) throw new Error('permission denied');
    if (/^UPDATE/.test(sql)) return { rows: [{ id: 'a' }] };
    return { rows: [] };
  };
  const r = await run(ctrl.update, { params: { id: 'a' }, body: { model: 'XMAX', is_published: false } });
  assert.equal(r.status, 200);
  const up = calls.find((c) => /^UPDATE/.test(c.sql));
  assert.doesNotMatch(up.sql, /is_published/);
});
