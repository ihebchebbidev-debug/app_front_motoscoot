/**
 * Couleurs des fiches techniques (owner, 2026-11-22).
 *
 * Acceptance rules:
 *   1. The admin sends a list or one text (« Blanc, Noir mat »): it is stored
 *      as a clean list, each colour once, at most 20.
 *   2. Create and update store the colours once the column exists; the API
 *      adds it itself (migration 042 run by hand or not).
 *   3. If the database refuses the column, the fiche is still saved, without
 *      colours (nothing else breaks).
 *   4. « Importer un lot » keeps the colours of each fiche.
 *
 * Runner: node --test tests/techSpecColors.test.js
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
const colors = require('../src/utils/techSpecColors');
const drafts = require('../src/utils/techSpecDrafts');
const { normalizeItem } = require('../src/utils/techSpecImport');
Module._load = realLoad;

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

const ADD_COLUMN = /ALTER TABLE tech_specs ADD COLUMN IF NOT EXISTS colors TEXT\[\]/;

test.beforeEach(() => {
  calls.length = 0;
  handler = async (sql) => (/ms_slugify/.test(sql) ? { rows: [{ base: 'sym-jet-14' }] } : { rows: [{ id: 'x' }] });
  colors._resetEnsured();
  drafts._resetEnsured();
});

test('a list or one text becomes a clean list, each colour once, 20 at most', () => {
  assert.deepEqual(colors.normalizeColors(['Blanc', ' Noir  mat ', 'blanc', '', 3]), ['Blanc', 'Noir mat']);
  assert.deepEqual(colors.normalizeColors('Blanc, Noir mat; Bleu\nGris'), ['Blanc', 'Noir mat', 'Bleu', 'Gris']);
  assert.deepEqual(colors.normalizeColors(null), []);
  assert.deepEqual(colors.normalizeColors({ a: 1 }), []);
  assert.equal(colors.normalizeColors(Array.from({ length: 30 }, (_, i) => `C${i}`)).length, 20);
  assert.equal(colors.normalizeColors(['x'.repeat(80)])[0].length, 40);
});

test('create stores the colours, after making sure the column exists', async () => {
  handler = async (sql) => (/ms_slugify/.test(sql) ? { rows: [{ base: 'sym-jet-14' }] } : /SELECT 1/.test(sql) ? { rows: [] } : { rows: [{ id: 'x' }] });
  const r = await run(ctrl.create, { body: { brand: 'SYM', model: 'Jet 14', year: 2026, category: 'Scooter', colors: 'Blanc, Noir mat' } });
  assert.equal(r.status, 201);
  assert.ok(calls.some((c) => ADD_COLUMN.test(c.sql)));
  const insert = calls.find((c) => /INSERT INTO tech_specs/.test(c.sql));
  assert.match(insert.sql, /, colors\)/);
  assert.deepEqual(insert.params.at(-1), ['Blanc', 'Noir mat']);
});

test('create without colours does not touch the column', async () => {
  handler = async (sql) => (/ms_slugify/.test(sql) ? { rows: [{ base: 'sym-jet-14' }] } : /SELECT 1/.test(sql) ? { rows: [] } : { rows: [{ id: 'x' }] });
  await run(ctrl.create, { body: { brand: 'SYM', model: 'Jet 14', year: 2026, category: 'Scooter' } });
  assert.ok(!calls.some((c) => ADD_COLUMN.test(c.sql)));
  assert.doesNotMatch(calls.find((c) => /INSERT INTO tech_specs/.test(c.sql)).sql, /colors/);
});

test('update stores the colours as a list', async () => {
  const r = await run(ctrl.update, { params: { id: 'x' }, body: { colors: ['Rouge', 'rouge', 'Gris'] } });
  assert.equal(r.status, 200);
  const upd = calls.find((c) => /UPDATE tech_specs SET/.test(c.sql));
  assert.match(upd.sql, /colors = \$1/);
  assert.deepEqual(upd.params[0], ['Rouge', 'Gris']);
});

test('when the database refuses the column, the fiche is saved without colours', async () => {
  handler = async (sql) => {
    if (ADD_COLUMN.test(sql)) throw new Error('permission denied');
    return { rows: [{ id: 'x' }] };
  };
  const r = await run(ctrl.update, { params: { id: 'x' }, body: { model: 'Jet 14 EVO', colors: ['Blanc'] } });
  assert.equal(r.status, 200);
  const upd = calls.find((c) => /UPDATE tech_specs SET/.test(c.sql));
  assert.doesNotMatch(upd.sql, /colors/);
  assert.match(upd.sql, /model = \$1/);
});

test('« Importer un lot » keeps the colours of each fiche', () => {
  const { fiche } = normalizeItem({ brand: 'SYM', model: 'Jet 14', year: 2026, category: 'Scooter', colors: ['Blanc', 'Bleu'] });
  assert.deepEqual(fiche.colors, ['Blanc', 'Bleu']);
  assert.deepEqual(normalizeItem({ brand: 'SYM', model: 'Jet 14', year: 2026, category: 'Scooter' }).fiche.colors, []);
});

test('« Importer un lot » stores the colours with each draft', async () => {
  handler = async (sql) => (/ms_slugify/.test(sql) ? { rows: [{ base: 'sym-jet-14' }] } : /SELECT brand, model, year/.test(sql) || /SELECT 1/.test(sql) ? { rows: [] } : { rows: [{ id: 'x' }] });
  const r = await run(ctrl.importBatch, { body: { fiches: [{ brand: 'SYM', model: 'Jet 14', year: 2026, category: 'Scooter', colors: 'Blanc, Bleu' }] } });
  assert.equal(r.status, 201);
  const insert = calls.find((c) => /INSERT INTO tech_specs/.test(c.sql));
  assert.match(insert.sql, /is_published, colors\)/);
  assert.deepEqual(insert.params.at(-1), ['Blanc', 'Bleu']);
});

test('migration 042 adds the column, idempotent', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../migrations/042_tech_specs_colors.sql'), 'utf8');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS colors TEXT\[\] NOT NULL DEFAULT '\{\}'/);
});
