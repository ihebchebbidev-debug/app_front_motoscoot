/**
 * Tests for the admin client-avatar endpoint (PATCH /admin/users/:id/avatar).
 *
 * These guard the acceptance rules of the backoffice profile-photo feature:
 *
 *   1. A relative "/uploads/<file>" URL is stored as-is (canonical form,
 *      same as the self-service avatar upload writes).
 *   2. An absolute URL pointing at our own /uploads/ storage is normalized
 *      to the relative form so the column stays consistent.
 *   3. An external http(s) URL (e.g. a Clerk-hosted image) is stored as-is.
 *   4. null / '' removes the photo (sets avatar_url to NULL).
 *   5. A missing avatar_url key or a non-string value is rejected with 400.
 *   6. A non-existent user returns 404.
 *   7. Every change is recorded in admin_logs (best-effort).
 *
 * Runner: node --test (no extra deps).
 *   $ node --test tests/adminUserAvatar.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

/* ------------------------------------------------------------------ *
 * Database mock — same pattern as conversations.integration.test.js:
 * installed into require.cache BEFORE the controller is loaded.
 * ------------------------------------------------------------------ */

const dbModulePath = require.resolve('../src/config/database');

let queryStack = [];
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

require.cache[dbModulePath] = {
  id: dbModulePath,
  filename: dbModulePath,
  loaded: true,
  exports: dbMock,
  children: [],
  paths: Module._nodeModulePaths(path.dirname(dbModulePath)),
};

// The controller also requires the mailer (nodemailer), which is not
// installed in the test environment — stub it, it is unused by setUserAvatar.
const mailerModulePath = require.resolve('../src/services/mailer');
require.cache[mailerModulePath] = {
  id: mailerModulePath,
  filename: mailerModulePath,
  loaded: true,
  exports: { sendListingApprovedEmail: async () => {}, sendListingRejectedEmail: async () => {} },
  children: [],
  paths: Module._nodeModulePaths(path.dirname(mailerModulePath)),
};

const controller = require('../src/controllers/adminController');

/* ------------------------------------------------------------------ *
 * Minimal req/res harness.
 * ------------------------------------------------------------------ */

function makeReq(body, params = { id: 'user-1' }) {
  return { body, params, query: {}, user: { id: 'admin-1' } };
}

function makeRes() {
  return {
    statusCode: 200,
    payload: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.payload = body; return this; },
  };
}

function expectUpdateAndAudit(storedUrl, rowCount = 1) {
  expectQuery(
    (sql, params) =>
      /UPDATE users SET avatar_url = \$1/.test(sql) &&
      params[0] === storedUrl &&
      params[1] === 'user-1',
    { rowCount, rows: rowCount ? [{ id: 'user-1' }] : [] },
    'avatar update'
  );
  if (rowCount) {
    expectQuery(
      (sql, params) =>
        /INSERT INTO admin_logs/.test(sql) &&
        params[0] === 'admin-1' &&
        params[2] === 'user' &&
        params[3] === 'user-1',
      { rows: [] },
      'audit log'
    );
  }
}

test('stores a relative /uploads/ URL as-is', async () => {
  resetDbMock();
  expectUpdateAndAudit('/uploads/abc.webp');
  const res = makeRes();
  await controller.setUserAvatar(makeReq({ avatar_url: '/uploads/abc.webp' }), res, (e) => { throw e; });
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.avatar_url, '/uploads/abc.webp');
});

test('normalizes an absolute URL on our own /uploads/ storage to relative', async () => {
  resetDbMock();
  expectUpdateAndAudit('/uploads/abc.webp');
  const res = makeRes();
  await controller.setUserAvatar(
    makeReq({ avatar_url: 'https://api.moto-scoot.tn/uploads/abc.webp' }),
    res,
    (e) => { throw e; }
  );
  assert.equal(res.payload.avatar_url, '/uploads/abc.webp');
});

test('stores an external http(s) URL as-is (e.g. Clerk-hosted image)', async () => {
  resetDbMock();
  expectUpdateAndAudit('https://img.clerk.com/xyz');
  const res = makeRes();
  await controller.setUserAvatar(makeReq({ avatar_url: 'https://img.clerk.com/xyz' }), res, (e) => { throw e; });
  assert.equal(res.payload.avatar_url, 'https://img.clerk.com/xyz');
});

test('null removes the photo', async () => {
  resetDbMock();
  expectUpdateAndAudit(null);
  const res = makeRes();
  await controller.setUserAvatar(makeReq({ avatar_url: null }), res, (e) => { throw e; });
  assert.equal(res.payload.avatar_url, null);
});

test('empty string removes the photo', async () => {
  resetDbMock();
  expectUpdateAndAudit(null);
  const res = makeRes();
  await controller.setUserAvatar(makeReq({ avatar_url: '' }), res, (e) => { throw e; });
  assert.equal(res.payload.avatar_url, null);
});

test('missing avatar_url key is rejected with 400', async () => {
  resetDbMock();
  const res = makeRes();
  await controller.setUserAvatar(makeReq({}), res, (e) => { throw e; });
  assert.equal(res.statusCode, 400);
  assert.equal(queryLog.length, 0);
});

test('non-string avatar_url is rejected with 400', async () => {
  resetDbMock();
  const res = makeRes();
  await controller.setUserAvatar(makeReq({ avatar_url: 42 }), res, (e) => { throw e; });
  assert.equal(res.statusCode, 400);
  assert.equal(queryLog.length, 0);
});

test('relative path outside /uploads/ is rejected with 400', async () => {
  resetDbMock();
  const res = makeRes();
  await controller.setUserAvatar(makeReq({ avatar_url: '/etc/passwd' }), res, (e) => { throw e; });
  assert.equal(res.statusCode, 400);
  assert.equal(queryLog.length, 0);
});

test('unknown user returns 404', async () => {
  resetDbMock();
  expectUpdateAndAudit('/uploads/abc.webp', 0);
  const res = makeRes();
  await controller.setUserAvatar(makeReq({ avatar_url: '/uploads/abc.webp' }), res, (e) => { throw e; });
  assert.equal(res.statusCode, 404);
});
