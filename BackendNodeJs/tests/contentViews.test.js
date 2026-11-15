/**
 * View counter for actualités and conseils (src/utils/contentViews.js).
 *
 * Acceptance rules:
 *   1. One visitor = one view per content per day: same key all day,
 *      new key the next day (Tunis calendar), different key per content.
 *   2. No raw IP is stored: the key is a 64-char one-way hash.
 *   3. A signed-in visitor is keyed by account (phone + computer = 1).
 *   4. Bots, link previews, headless browsers and empty user agents are
 *      ignored without touching the database.
 *   5. Only published content is counted; unknown/draft → 404.
 *   6. The counter only moves when a new daily row was inserted.
 *
 * Runner: node --test (no extra deps).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const dbModulePath = require.resolve('../src/config/database');
let queries = [];
let nextResults = [];
require.cache[dbModulePath] = {
  id: dbModulePath, filename: dbModulePath, loaded: true,
  exports: {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (!nextResults.length) throw new Error(`Unexpected query: ${sql.slice(0, 80)}`);
      return nextResults.shift();
    },
    pool: {},
  },
};

const { makeTrackView, visitorKey, tunisDay, isBot } = require('../src/utils/contentViews');

const base = { contentId: 'c1', ip: '41.1.2.3', userAgent: 'Mozilla/5.0 (iPhone)', secret: 's' };

test('same visitor, same content, same day → same key', () => {
  const a = visitorKey({ ...base, now: new Date('2026-11-15T08:00:00Z') });
  const b = visitorKey({ ...base, now: new Date('2026-11-15T21:00:00Z') });
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.ok(!a.includes('41.1.2.3'));
});

test('next Tunis day or another content → new key', () => {
  const day1 = visitorKey({ ...base, now: new Date('2026-11-15T22:30:00Z') });
  // 23:30 UTC on the 15th is already the 16th in Tunis (UTC+1).
  const day2 = visitorKey({ ...base, now: new Date('2026-11-15T23:30:00Z') });
  assert.notEqual(day1, day2);
  assert.equal(tunisDay(new Date('2026-11-15T23:30:00Z')), '2026-11-16');
  assert.notEqual(
    visitorKey({ ...base, now: new Date('2026-11-15T08:00:00Z') }),
    visitorKey({ ...base, contentId: 'c2', now: new Date('2026-11-15T08:00:00Z') }),
  );
});

test('a signed-in reader counts once across devices', () => {
  const now = new Date('2026-11-15T08:00:00Z');
  const phone = visitorKey({ ...base, userId: 'u9', now });
  const laptop = visitorKey({ ...base, ip: '197.0.0.1', userAgent: 'Mozilla/5.0 (Macintosh)', userId: 'u9', now });
  assert.equal(phone, laptop);
});

test('bots, previews and headless browsers are not readers', () => {
  for (const ua of [
    'Mozilla/5.0 (compatible; Googlebot/2.1)', 'facebookexternalhit/1.1', 'WhatsApp/2.23',
    'Mozilla/5.0 Chrome-Lighthouse', 'Mozilla/5.0 HeadlessChrome/120', 'curl/8.0', '',
  ]) assert.equal(isBot(ua), true, ua);
  assert.equal(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1'), false);
});

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const req = (ua, slug = 'mon-article', user) => ({
  headers: { 'user-agent': ua }, params: { slug }, ip: '41.1.2.3', user,
});
const reader = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1';

test('a bot never reaches the database', async () => {
  queries = []; nextResults = [];
  const res = fakeRes();
  await makeTrackView('articles')(req('Googlebot/2.1'), res, (e) => { throw e; });
  assert.deepEqual(res.body, { success: true, counted: false, reason: 'bot' });
  assert.equal(queries.length, 0);
});

test('drafts and unknown content are not counted (404)', async () => {
  queries = []; nextResults = [{ rows: [] }];
  const res = fakeRes();
  await makeTrackView('tips')(req(reader), res, (e) => { throw e; });
  assert.equal(res.statusCode, 404);
  assert.match(queries[0].sql, /FROM tips/);
  assert.match(queries[0].sql, /is_published = TRUE/);
});

test('first view of the day is counted, the next one is not', async () => {
  queries = []; nextResults = [{ rows: [{ id: 'a1' }] }, { rows: [{ views_count: 12 }] }];
  let res = fakeRes();
  await makeTrackView('articles')(req(reader), res, (e) => { throw e; });
  assert.deepEqual(res.body, { success: true, counted: true });
  const insert = queries[1];
  assert.match(insert.sql, /INSERT INTO article_views \(article_id, fingerprint\)/);
  assert.match(insert.sql, /WHERE NOT EXISTS/);
  assert.match(insert.sql, /UPDATE articles SET views_count/);
  assert.equal(insert.params[0], 'a1');
  assert.match(insert.params[1], /^[0-9a-f]{64}$/);

  queries = []; nextResults = [{ rows: [{ id: 'a1' }] }, { rows: [] }];
  res = fakeRes();
  await makeTrackView('articles')(req(reader), res, (e) => { throw e; });
  assert.deepEqual(res.body, { success: true, counted: false });
});

test('conseils use their own tables', async () => {
  queries = []; nextResults = [{ rows: [{ id: 't1' }] }, { rows: [{ views_count: 1 }] }];
  await makeTrackView('tips')(req(reader, 'changer-pneu'), fakeRes(), (e) => { throw e; });
  assert.match(queries[1].sql, /INSERT INTO tip_views \(tip_id, fingerprint\)/);
  assert.match(queries[1].sql, /UPDATE tips SET views_count/);
});

test('only known content kinds are accepted', () => {
  assert.throws(() => makeTrackView('users'));
});
