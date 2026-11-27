/**
 * Contact taps on a listing (listingsExtraController.trackContact).
 * Fake database, installed before the controller loads it.
 * Runner: node --test tests/listingContacts.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const calls = [];
let insertRows = [{ id: 'c1' }];
const dbPath = require.resolve('../src/config/database');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true,
  exports: { query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: sql.includes('INSERT INTO listing_contacts') ? insertRows : [] };
  } } };

const ctrl = require('../src/controllers/listingsExtraController');

const res = () => { const r = { code: 200 }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
const human = { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' };
const tap = async (body, extra = {}) => {
  calls.length = 0;
  const r = res();
  await ctrl.trackContact({ params: { id: 'L1' }, body, headers: human, ...extra }, r, (e) => { throw e; });
  return r;
};
const inserted = () => calls.find((c) => c.sql.includes('INSERT INTO listing_contacts'));
const bumped = () => calls.some((c) => c.sql.includes('contacts_count = contacts_count + 1'));

test("the Appeler button sends 'phone': stored as 'call', the only value the database accepts", async () => {
  insertRows = [{ id: 'c1' }];
  const r = await tap({ channel: 'phone', session_id: 'tab-1' });
  assert.deepEqual(inserted().params, ['L1', null, 'call', 'tab-1']);
  assert.ok(bumped());
  assert.equal(r.body.counted, true);
});

test('whatsapp and message are stored as sent; an unknown channel is refused', async () => {
  await tap({ channel: 'whatsapp', session_id: 'tab-1' });
  assert.equal(inserted().params[2], 'whatsapp');
  await tap({ channel: 'message' });
  assert.equal(inserted().params[2], 'message');
  const r = await tap({ channel: 'pigeon' });
  assert.equal(r.code, 400);
  assert.equal(inserted(), undefined);
});

test('two anonymous visitors on the same listing are two contacts: the repeat check is per tab', async () => {
  await tap({ channel: 'phone', session_id: 'tab-A' });
  const sql = inserted().sql;
  assert.match(sql, /WHEN \$4::text IS NOT NULL THEN user_id IS NULL AND session_id = \$4::text/);
  assert.match(sql, /WHEN \$2::uuid IS NOT NULL THEN user_id = \$2::uuid/);
  assert.match(sql, /INTERVAL '1 hour'/);
});

test('a signed-in visitor is recognised by account', async () => {
  await tap({ channel: 'phone', session_id: 'tab-A' }, { user: { id: 'u-9' } });
  assert.deepEqual(inserted().params, ['L1', 'u-9', 'call', 'tab-A']);
});

test('a repeat within the hour is not counted again', async () => {
  insertRows = [];
  const r = await tap({ channel: 'phone', session_id: 'tab-A' });
  assert.equal(bumped(), false);
  assert.equal(r.body.counted, false);
  insertRows = [{ id: 'c1' }];
});

test('robots are not counted', async () => {
  calls.length = 0;
  const r = res();
  await ctrl.trackContact({ params: { id: 'L1' }, body: { channel: 'phone' }, headers: { 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' } }, r, (e) => { throw e; });
  assert.equal(r.code, 202);
  assert.equal(calls.length, 0);
});

test('the session column is added once, before the first insert', async () => {
  // The column check ran during the first test; later taps go straight to the insert.
  await tap({ channel: 'phone', session_id: 'tab-B' });
  assert.equal(calls.some((c) => c.sql.includes('ADD COLUMN IF NOT EXISTS session_id')), false);
});
