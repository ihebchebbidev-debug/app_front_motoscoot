/**
 * GET /api/tech-specs/search (« Modèles correspondants » on /fiches-techniques).
 *
 * The query used to name engine_cc, engine_power, transmission, frame, abs…
 * as columns. They do not exist (those details live in the JSONB blocks
 * engine / chassis / electronics), so PostgreSQL rejected every search and
 * the API answered 500. This test captures the SQL with a fake database and
 * checks every column it names against the schema in migrations/.
 *
 * Runner: node --test tests/techSpecsSearch.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Fake database module, installed before the controller loads it.
const calls = [];
const dbPath = require.resolve('../src/config/database');
require.cache[dbPath] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } },
};
const { searchAll } = require('../src/controllers/techSpecsExtraController');

/** Columns of tech_specs: CREATE TABLE + every « ALTER TABLE tech_specs ADD COLUMN ». */
function techSpecsColumns() {
  const dir = path.join(__dirname, '..', 'migrations');
  const cols = new Set();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql'))) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    const create = sql.match(/CREATE TABLE IF NOT EXISTS tech_specs \(([\s\S]*?)\n\);/);
    if (create) for (const line of create[1].split('\n')) {
      const m = line.trim().match(/^([a-z_]+)\s+[A-Z]/);
      if (m) cols.add(m[1]);
    }
    for (const m of sql.matchAll(/ALTER TABLE tech_specs\s+ADD COLUMN IF NOT EXISTS\s+([a-z_]+)/gi)) cols.add(m[1]);
  }
  return cols;
}

async function run(q) {
  calls.length = 0;
  let body;
  await searchAll({ query: { q, limit: '30' } }, { json: (b) => { body = b; } }, (e) => { throw e; });
  return { body, call: calls[0] };
}

test('the search names only columns that exist in tech_specs', async () => {
  const { call } = await run('jet');
  const cols = techSpecsColumns();
  assert.ok(cols.has('engine') && cols.has('chassis') && cols.has('electronics') && cols.has('available_in_tunisia'));
  const named = [...call.sql.matchAll(/\bt\.([a-z_]+)/g)].map((m) => m[1]);
  const missing = [...new Set(named)].filter((c) => !cols.has(c));
  assert.deepEqual(missing, []);
  for (const gone of ['engine_cc', 'engine_power', 'engine_torque', 'engine_type', 'fuel_system', 'riding_modes']) {
    assert.doesNotMatch(call.sql, new RegExp(`\\b${gone}\\b`));
  }
});

test('engine, chassis and electronics are searched by their values, not their keys', async () => {
  const { call } = await run('abs');
  for (const block of ['engine', 'chassis', 'electronics']) {
    assert.match(call.sql, new RegExp(`jsonb_each_text\\(CASE WHEN jsonb_typeof\\(t\\.${block}\\) = 'object' THEN t\\.${block} ELSE '\\{\\}'::jsonb END\\) AS v WHERE v\\.value ILIKE \\$1`));
  }
  // « SYM Jet » finds Jet models: brand and model searched together.
  assert.match(call.sql, /\(t\.brand \|\| ' ' \|\| t\.model\) ILIKE \$1/);
});

test('parameters: escaped LIKE pattern and a capped limit; empty query answers [] without SQL', async () => {
  const { call } = await run('50%_cc');
  assert.equal(call.params[0], '%50\\%\\_cc%');
  assert.equal(call.params[1], 30);
  const empty = await run('   ');
  assert.deepEqual(empty.body, []);
  assert.equal(empty.call, undefined);
});
