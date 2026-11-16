/**
 * Admin › Fiches techniques list (GET /admin/tech-specs).
 *
 * Acceptance rules:
 *   1. Filters: status (published / draft / incomplete), brand and category
 *      (exact, case and outer spaces ignored), available in Tunisia, search.
 *      Every value travels as a query parameter, never inside the SQL.
 *   2. Sort: recent (default), updated, brand, year, views. Anything else
 *      falls back to "recent"; "views" falls back too while the
 *      model_visits table does not exist yet.
 *   3. The status counters apply every filter except the status itself,
 *      and the response carries brand and category choices with counts.
 *   4. "À compléter" = no photo, or neither cc nor power (same rule as the
 *      "Publier" confirmation in the admin).
 *
 * Runner: node --test tests/techSpecAdminList.test.js
 * (The same controller was also run against a real PostgreSQL — PGlite —
 * for the PR: filters, counters, sorts, pagination, import and publish.)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const SRC = path.resolve(__dirname, '../src');
const calls = [];
let visitsTable = false;
const dbMock = {
  query: async (sql, params = []) => {
    calls.push({ sql, params });
    if (/to_regclass/.test(sql)) return { rows: [{ ok: visitsTable }] };
    if (/COUNT\(\*\)::int AS "all"/.test(sql)) return { rows: [{ all: 5, published: 4, draft: 1, incomplete: 2 }] };
    if (/GROUP BY LOWER\(TRIM\(brand\)\)/.test(sql)) return { rows: [{ name: 'SYM', count: 2 }] };
    if (/GROUP BY LOWER\(TRIM\(category\)\)/.test(sql)) return { rows: [{ name: 'Scooter', count: 2 }] };
    return { rows: [{ id: 'a', model: 'CBR500R' }] };
  },
  pool: {},
};

const realLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  let resolved;
  try { resolved = Module._resolveFilename(request, parent, isMain); } catch { resolved = request; }
  if (resolved === path.join(SRC, 'config/database.js')) return dbMock;
  return realLoad.apply(this, arguments);
};
const admin = require('../src/controllers/adminContentController');
const { buildFilters, orderBy, SORTS, INCOMPLETE_SQL } = require('../src/utils/techSpecAdminList');
Module._load = realLoad;

function run(q) {
  calls.length = 0;
  return new Promise((resolve, reject) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve(b); } };
    admin.listTechSpecs({ query: q }, res, (e) => reject(e || new Error('next() without error')));
  });
}
const listSql = () => calls.find((c) => /ORDER BY/.test(c.sql) && /LIMIT/.test(c.sql));

test('filters travel as parameters, status is kept out of the counters', () => {
  const f = buildFilters({ search: "50%_x", brand: ' SYM ', category: 'scooter', tunisia: 'false', status: 'draft' });
  assert.equal(f.base.length, 4);
  assert.deepEqual(f.params, ['%50\\%\\_x%', ' SYM ', 'scooter']);
  assert.match(f.base.join(' '), /LOWER\(TRIM\(t\.brand\)\) = LOWER\(TRIM\(\$2\)\)/);
  assert.match(f.base.join(' '), /available_in_tunisia = FALSE/);
  assert.match(f.statusSql, /^NOT COALESCE/);
  assert.equal(buildFilters({ status: 'incomplete' }).statusSql, INCOMPLETE_SQL);
  assert.equal(buildFilters({ status: 'nope', tunisia: 'maybe' }).statusSql, undefined);
  assert.equal(buildFilters({ tunisia: 'maybe' }).base.length, 0);
});

test('only known sorts reach ORDER BY; views needs model_visits', () => {
  assert.equal(orderBy(undefined, true), SORTS.recent);
  assert.equal(orderBy('x; DROP TABLE tech_specs', true), SORTS.recent);
  assert.equal(orderBy('brand', false), SORTS.brand);
  assert.equal(orderBy('views', false), SORTS.recent);
  assert.equal(orderBy('views', true), SORTS.views);
});

test('the list answers counters, choices and the page of the selected status', async () => {
  const body = await run({ status: 'draft', brand: 'Honda', sort: 'year', page: '2', limit: '10' });
  assert.deepEqual(body.counts, { all: 5, published: 4, draft: 1, incomplete: 2 });
  assert.equal(body.total, 1, 'total = count of the selected status');
  assert.deepEqual(body.facets, { brands: [{ name: 'SYM', count: 2 }], categories: [{ name: 'Scooter', count: 2 }] });

  const counter = calls.find((c) => /AS "all"/.test(c.sql));
  assert.doesNotMatch(counter.sql, /WHERE NOT COALESCE\(\(to_jsonb\(t\)->>'is_published'\)::boolean, TRUE\)\s*$/m);
  assert.deepEqual(counter.params, ['Honda']);

  const list = listSql();
  assert.match(list.sql, /NOT COALESCE\(\(to_jsonb\(t\)->>'is_published'\)/);
  assert.ok(list.sql.includes(`ORDER BY ${SORTS.year}`));
  assert.deepEqual(list.params, ['Honda', 10, 10], 'page 2 of 10 = offset 10');
  assert.doesNotMatch(list.sql, /model_visits/);
});

test('the views sort joins model_visits once it exists', async () => {
  visitsTable = true;
  try {
    await run({ sort: 'views' });
    assert.match(listSql().sql, /LEFT JOIN model_visits mv ON mv\.brand = t\.brand AND mv\.model = t\.model/);
    assert.ok(listSql().sql.includes(`ORDER BY ${SORTS.views}`));
  } finally { visitsTable = false; }
});
