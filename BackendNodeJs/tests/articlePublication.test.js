const test = require('node:test');
const assert = require('node:assert/strict');
const db = require.resolve('../src/config/database');
const calls = [];
require.cache[db] = { id: db, filename: db, loaded: true, exports: {
  query: async (sql, args) => {
    calls.push({ sql, args });
    return { rows: sql.includes('SELECT a.*') ? [] : [{ id: 'article', author_id: 'editor' }] };
  },
} };
const controller = require('../src/controllers/articlesController');

async function run(action, body) {
  calls.length = 0;
  const req = { body, params: { slug: 'article', id: 'article' }, user: { id: 'editor' }, staffRole: 'admin', headers: {} };
  const res = { status(code) { this.code = code; return this; }, json(value) { this.data = value; } };
  await action(req, res, err => { throw err; });
  return res;
}

test('creation honors draft status and keeps the default for existing callers', async () => {
  const body = { title: 'Article', category: 'Tech', slug: 'article' };
  for (const [extra, expected] of [[{ is_published: false }, false], [{}, true], [{ is_published: true }, true]]) {
    assert.equal((await run(controller.create, { ...body, ...extra })).code, 201);
    assert.equal(calls[0].args.at(-1), expected);
    assert.match(calls[0].sql, /\$11,CASE WHEN \$11 THEN NOW\(\) END/);
  }
});

test('the dedicated draft endpoint forces an unpublished record even if the payload requests publication', async () => {
  await run(controller.createDraft, { title: 'Article', category: 'Tech', slug: 'article', is_published: true });
  assert.equal(calls[0].args.at(-1), false);
});

test('public detail only reads published articles and publishing stamps the first publication', async () => {
  assert.equal((await run(controller.getBySlug, {})).code, 404);
  assert.match(calls[0].sql, /AND a\.is_published = TRUE/);
  await run(controller.update, { is_published: true });
  assert.match(calls.at(-1).sql, /published_at = COALESCE\(published_at, NOW\(\)\)/);
  await run(controller.update, { title: 'Correction' });
  assert.doesNotMatch(calls.at(-1).sql, /published_at/);
});
