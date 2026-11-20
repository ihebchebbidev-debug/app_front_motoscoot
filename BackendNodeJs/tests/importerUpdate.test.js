/**
 * Editing an importer (Admin › Importateurs › Modifier) answered 500 every
 * time: buildUpdate already ends the SET list with « updated_at = NOW() »
 * and the controller added a second one; PostgreSQL refuses two
 * assignments to the same column. Creating and deleting were fine.
 * Fake database installed before the controller loads it.
 * Runner: node --test tests/importerUpdate.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const calls = [];
const dbPath = require.resolve('../src/config/database');
require.cache[dbPath] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('information_schema.columns')) return { rows: [{ found: 1 }] };
      if (sql.startsWith('UPDATE importers')) return { rows: [{ id: 'i1' }] };
      return { rows: [] };
    },
  },
};
const ctrl = require('../src/controllers/importersController');

const res = () => {
  const r = { code: 200 };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};

test('an importer edit sets updated_at once, with or without a subscription date', async () => {
  for (const body of [
    { name: 'SODIV', phone: '71 000 000' },
    { name: 'SODIV', phone: '71 000 000', subscription_until: '2027-11-20' },
    { name: 'SODIV', subscription_until: null },
  ]) {
    calls.length = 0;
    const r = res();
    await ctrl.update({ params: { id: 'i1' }, body }, r, (e) => { throw e; });
    const upd = calls.find((c) => c.sql.startsWith('UPDATE importers'));
    assert.equal((upd.sql.match(/updated_at\s*=/g) || []).length, 1, upd.sql);
    assert.equal(r.code, 200);
  }
});

test('a subscription date is saved in its column, never through ALTER TABLE when it exists', async () => {
  calls.length = 0;
  await ctrl.update({ params: { id: 'i1' }, body: { name: 'SODIV', subscription_until: '2027-11-20' } }, res(), (e) => { throw e; });
  const upd = calls.find((c) => c.sql.startsWith('UPDATE importers'));
  assert.match(upd.sql, /subscription_until = \$\d/);
  assert.ok(upd.params.includes('2027-11-20'));
  assert.ok(!calls.some((c) => c.sql.startsWith('ALTER TABLE')));
});
