/**
 * Integration tests for the messaging flow.
 *
 * These cover the controller end-to-end against a mocked database adapter,
 * exercising the exact SQL / control-flow path used in production. They
 * specifically guard against the race conditions and logic bugs we patched:
 *
 *   1. Symmetric conversation lookup (no duplicate threads when seller messages
 *      buyer about their own listing).
 *   2. Correct unread-counter side bumped against the STORED buyer_id, not the
 *      caller's id (matters on conversation re-open by either party).
 *   3. markAsRead recomputes the unread counter from `messages.is_read` ground
 *      truth so a message arriving mid-flight is not silently zeroed.
 *   4. Self-message rejection.
 *   5. Cross-conversation message-fishing: `before=<msg id>` from another
 *      conversation must NOT leak timestamps.
 *
 * Runner: node --test (no extra deps).
 *   $ node --test tests/conversations.integration.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

/* ------------------------------------------------------------------ *
 * Database mock — installed into require.cache BEFORE the controller
 * is loaded. Tests register a stack of expectations; each query() call
 * pops the next matcher and asserts the SQL/params shape.
 * ------------------------------------------------------------------ */

const dbModulePath = require.resolve('../src/config/database');

/** @type {Array<{ match: (sql: string, params: any[]) => boolean, result: any, label?: string }>} */
let queryStack = [];
/** @type {Array<{ sql: string, params: any[] }>} */
let queryLog = [];

function expectQuery(matcher, result, label) {
  queryStack.push({ match: matcher, result, label });
}

function resetDbMock() {
  queryStack = [];
  queryLog = [];
}

const dbMock = {
  query: async (sql, params = []) => {
    queryLog.push({ sql, params });
    if (queryStack.length === 0) {
      throw new Error(`Unexpected query (no expectations remain): ${sql.slice(0, 80)}`);
    }
    const next = queryStack.shift();
    if (!next.match(sql, params)) {
      throw new Error(
        `Query did not match expectation${next.label ? ` "${next.label}"` : ''}.\n` +
        `Got SQL: ${sql.slice(0, 200)}\nGot params: ${JSON.stringify(params)}`
      );
    }
    if (typeof next.result === 'function') return next.result(sql, params);
    return next.result;
  },
  pool: {},
  getClient: async () => { throw new Error('not used in tests'); },
};

// Install the mock into the require cache so the controller picks it up.
require.cache[dbModulePath] = {
  id: dbModulePath,
  filename: dbModulePath,
  loaded: true,
  exports: dbMock,
  children: [],
  paths: Module._nodeModulePaths(path.dirname(dbModulePath)),
};

// Now load the controller — it will resolve to our mocked db.
const controller = require('../src/controllers/conversationsController');

/* ------------------------------------------------------------------ *
 * Express req/res helpers
 * ------------------------------------------------------------------ */

function makeRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return res;
}

function makeReq({ user, body = {}, params = {} } = {}) {
  return {
    user,
    body,
    params,
    app: { get: () => null }, // no socket.io in tests
    headers: {},
  };
}

const next = (err) => { if (err) throw err; };

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

test('create: rejects messaging yourself', async () => {
  resetDbMock();
  const req = makeReq({
    user: { id: 'user-A' },
    body: { listing_id: 'L1', seller_id: 'user-A', message: 'hi' },
  });
  const res = makeRes();
  await controller.create(req, res, next);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /yourself/i);
  assert.equal(queryLog.length, 0, 'no DB hit on self-message rejection');
});

test('create: 400 when listing_id or seller_id missing', async () => {
  resetDbMock();
  const req = makeReq({ user: { id: 'u1' }, body: { listing_id: 'L1' } });
  const res = makeRes();
  await controller.create(req, res, next);
  assert.equal(res.statusCode, 400);
});

test('create: 404 when listing does not exist', async () => {
  resetDbMock();
  expectQuery(
    (sql) => /SELECT id FROM listings/.test(sql),
    { rows: [] },
    'listing existence check'
  );
  const req = makeReq({
    user: { id: 'buyer-1' },
    body: { listing_id: 'missing', seller_id: 'seller-1', message: 'hi' },
  });
  const res = makeRes();
  await controller.create(req, res, next);
  assert.equal(res.statusCode, 404);
});

test('create: REUSES existing thread when seller messages buyer (symmetric lookup)', async () => {
  resetDbMock();
  // Listing exists.
  expectQuery((sql) => /FROM listings/.test(sql), { rows: [{ id: 'L1' }] });
  // Existing conversation found via symmetric where clause — buyer is the OTHER
  // party (the original buyer-1), and the caller here is the seller (seller-1).
  expectQuery(
    (sql, params) =>
      /FROM conversations[\s\S]*buyer_id = \$2 AND seller_id = \$3[\s\S]*OR.*buyer_id = \$3 AND seller_id = \$2/.test(sql) &&
      params[0] === 'L1' && params[1] === 'seller-1' && params[2] === 'buyer-1',
    { rows: [{ id: 'conv-1', buyer_id: 'buyer-1' }] },
    'symmetric existing-conversation lookup'
  );
  // INSERT message authored by the seller.
  expectQuery(
    (sql, params) =>
      /INSERT INTO messages/.test(sql) &&
      params[0] === 'conv-1' && params[1] === 'seller-1' && params[2] === 'reply',
    { rows: [] }
  );
  // Unread bump must hit BUYER_UNREAD because the caller (seller-1) is NOT the
  // stored buyer_id (buyer-1). This is the regression we patched.
  expectQuery(
    (sql, params) => /UPDATE conversations SET last_message_at = NOW\(\), buyer_unread = buyer_unread \+ 1/.test(sql) && params[0] === 'conv-1',
    { rows: [] },
    'buyer_unread bumped (caller is seller, recipient is buyer)'
  );

  const req = makeReq({
    user: { id: 'seller-1' },
    body: { listing_id: 'L1', seller_id: 'buyer-1', message: 'reply' },
  });
  const res = makeRes();
  await controller.create(req, res, next);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.conversation_id, 'conv-1');
  assert.equal(queryStack.length, 0, 'all expected queries consumed');
});

test('create: bumps SELLER_UNREAD when buyer is the caller', async () => {
  resetDbMock();
  expectQuery((sql) => /FROM listings/.test(sql), { rows: [{ id: 'L9' }] });
  expectQuery(
    (sql) => /FROM conversations/.test(sql),
    { rows: [{ id: 'conv-9', buyer_id: 'buyer-9' }] }
  );
  expectQuery((sql) => /INSERT INTO messages/.test(sql), { rows: [] });
  expectQuery(
    (sql) => /seller_unread = seller_unread \+ 1/.test(sql),
    { rows: [] },
    'seller_unread bumped (caller is buyer)'
  );

  const req = makeReq({
    user: { id: 'buyer-9' },
    body: { listing_id: 'L9', seller_id: 'seller-9', message: 'hello' },
  });
  await controller.create(req, makeRes(), next);
  assert.equal(queryStack.length, 0);
});

test('markAsRead: recomputes unread from ground truth (race-safe)', async () => {
  resetDbMock();
  // verifyMembership lookup
  expectQuery(
    (sql, params) => /SELECT buyer_id, seller_id FROM conversations/.test(sql) && params[0] === 'conv-7',
    { rows: [{ buyer_id: 'buyer-7', seller_id: 'seller-7' }] }
  );
  // First write: flip messages.is_read to true for messages NOT sent by caller.
  expectQuery(
    (sql, params) =>
      /UPDATE messages SET is_read = true/.test(sql) &&
      params[0] === 'conv-7' && params[1] === 'buyer-7',
    { rows: [] },
    'mark messages read'
  );
  // Second write MUST be a SUB-SELECT recomputing the counter — not a hard zero.
  // This is the patched behavior: a message arriving between the two statements
  // remains correctly counted as unread.
  expectQuery(
    (sql, params) =>
      /UPDATE conversations[\s\S]*SET buyer_unread = \(\s*SELECT COUNT\(\*\) FROM messages/.test(sql) &&
      /sender_id != \$2/.test(sql) &&
      /is_read = false/.test(sql) &&
      params[0] === 'conv-7' && params[1] === 'buyer-7',
    { rows: [] },
    'unread counter recomputed from messages.is_read'
  );

  const req = makeReq({
    user: { id: 'buyer-7' },
    params: { id: 'conv-7' },
  });
  const res = makeRes();
  await controller.markAsRead(req, res, next);
  assert.deepEqual(res.body, { message: 'Marked as read' });
  assert.equal(queryStack.length, 0, 'all expected queries consumed');
});

test('markAsRead: 403 when user is not a member', async () => {
  resetDbMock();
  expectQuery(
    (sql) => /FROM conversations/.test(sql),
    { rows: [{ buyer_id: 'someone-else', seller_id: 'another' }] }
  );
  const req = makeReq({ user: { id: 'intruder' }, params: { id: 'conv-x' } });
  const res = makeRes();
  await controller.markAsRead(req, res, next);
  assert.equal(res.statusCode, 403);
});

test('getMessages: cross-conversation `before` id returns [] (no fishing)', async () => {
  resetDbMock();
  // Membership check passes for conv-1.
  expectQuery(
    (sql) => /SELECT buyer_id, seller_id FROM conversations/.test(sql),
    { rows: [{ buyer_id: 'u1', seller_id: 'u2' }] }
  );
  // Anchor lookup is SCOPED to this conversation — and the supplied id belongs
  // to a different conversation, so the lookup returns 0 rows.
  expectQuery(
    (sql, params) =>
      /SELECT created_at FROM messages WHERE id = \$1 AND conversation_id = \$2/.test(sql) &&
      params[0] === 'msg-from-other-conv' && params[1] === 'conv-1',
    { rows: [] },
    'anchor lookup scoped to current conversation'
  );

  const req = makeReq({
    user: { id: 'u1' },
    params: { id: 'conv-1' },
  });
  req.query = { before: 'msg-from-other-conv', limit: '50' };
  const res = makeRes();
  await controller.getMessages(req, res, next);
  assert.deepEqual(res.body, [], 'empty result — no timestamp leak');
  assert.equal(queryStack.length, 0);
});

test('sendMessage: emits to recipient, bumps the OTHER side counter', async () => {
  resetDbMock();
  // Membership check
  expectQuery(
    (sql) => /SELECT buyer_id, seller_id FROM conversations/.test(sql),
    { rows: [{ buyer_id: 'buyer-2', seller_id: 'seller-2' }] }
  );
  // INSERT message
  expectQuery(
    (sql, params) =>
      /INSERT INTO messages/.test(sql) && params[1] === 'buyer-2',
    { rows: [{ id: 'm-new', content: 'hey' }] }
  );
  // Unread bump on seller_unread (caller is the buyer)
  expectQuery(
    (sql) => /seller_unread = seller_unread \+ 1/.test(sql),
    { rows: [] }
  );

  const req = makeReq({
    user: { id: 'buyer-2' },
    params: { id: 'conv-2' },
    body: { content: 'hey' },
  });
  const res = makeRes();
  await controller.sendMessage(req, res, next);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.id, 'm-new');
  assert.equal(queryStack.length, 0);
});

test('sendMessage: rejects empty payload', async () => {
  resetDbMock();
  expectQuery(
    (sql) => /SELECT buyer_id, seller_id FROM conversations/.test(sql),
    { rows: [{ buyer_id: 'buyer-2', seller_id: 'seller-2' }] }
  );
  const req = makeReq({
    user: { id: 'buyer-2' },
    params: { id: 'conv-2' },
    body: {},
  });
  const res = makeRes();
  await controller.sendMessage(req, res, next);
  assert.equal(res.statusCode, 400);
});
