/**
 * Moderator access to the back-office (routes/admin.js + requireStaff).
 *
 * Acceptance rules:
 *   1. A moderator can list, add and edit actualités, conseils and fiches
 *      techniques (and read the importer list the fiche form needs).
 *   2. A moderator can NOT delete them, and gets 403 on every other admin
 *      route (stats, users, settings…).
 *   3. An admin keeps full access, deletion included.
 *   4. A plain user gets 403 everywhere, including the content routes.
 *   5. GET /admin/access tells the front which back-office to show.
 *
 * The real router file and the real auth middleware are loaded; only the
 * database, the JWT library, the logger and the controllers are stubbed
 * (each stub handler answers 200 with its own name).
 *
 * Runner: node --test (no extra deps).
 *   $ node --test tests/adminModeratorAccess.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const http = require('node:http');

const SRC = path.resolve(__dirname, '../src');

/* ------------------------------------------------------------------ *
 * Users: the bearer token IS the user id. Roles per user:
 * ------------------------------------------------------------------ */
const ROLES = {
  admin: ['admin'],
  mod: ['moderator'],
  both: ['moderator', 'admin'],
  user: ['user'],
};

const dbMock = {
  query: async (sql, params = []) => {
    if (/token_blacklist/.test(sql)) return { rows: [] };
    if (/SELECT is_active FROM users/.test(sql)) return { rows: [{ is_active: true }] };
    if (/FROM user_roles/.test(sql)) {
      const roles = ROLES[params[0]] || [];
      if (/role IN \('admin', 'moderator'\)/.test(sql)) {
        return { rows: roles.filter((r) => r === 'admin' || r === 'moderator').map((role) => ({ role })) };
      }
      if (params[1] === 'admin') return { rows: roles.includes('admin') ? [{ '?column?': 1 }] : [] };
    }
    throw new Error(`Unexpected query: ${sql.slice(0, 120)}`);
  },
  pool: {},
  getClient: async () => { throw new Error('not used'); },
};

/** A route handler stub that answers with its own name; any property access
 *  (ref.vehicleCategories.list, upload.single…) yields another stub. */
function makeStub(name) {
  const fn = (req, res) => res.status(200).json({ handler: name });
  return new Proxy(fn, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'single' || prop === 'array') return () => (_req, _res, next) => next();
      return makeStub(`${name}.${String(prop)}`);
    },
  });
}

const stubModule = (name) => new Proxy({}, { get: (_t, prop) => makeStub(`${name}.${String(prop)}`) });

const realLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'jsonwebtoken') {
    return { verify: (token) => ({ id: token }), sign: () => 'signed' };
  }
  let resolved;
  try { resolved = Module._resolveFilename(request, parent, isMain); } catch { resolved = request; }
  if (resolved === path.join(SRC, 'config/database.js')) return dbMock;
  if (resolved === path.join(SRC, 'config/jwt.js')) return { JWT_SECRET: 'test' };
  if (resolved === path.join(SRC, 'utils/logger.js')) return { info() {}, warn() {}, error() {}, debug() {} };
  if (resolved.startsWith(path.join(SRC, 'controllers') + path.sep) ||
      resolved.startsWith(path.join(SRC, 'services') + path.sep)) {
    return stubModule(path.basename(resolved, '.js'));
  }
  return realLoad.apply(this, arguments);
};

const express = require('express');
const adminRouter = require('../src/routes/admin');
Module._load = realLoad;

let server;
let base;

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/api/admin`;
});

test.after(() => new Promise((r) => server.close(r)));

async function call(user, method, url) {
  const res = await fetch(base + url, {
    method,
    headers: { Authorization: `Bearer ${user}`, 'Content-Type': 'application/json' },
    body: method === 'GET' || method === 'DELETE' ? undefined : '{}',
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

const MODERATOR_ROUTES = [
  ['GET', '/articles', 'adminContentController.listArticles'],
  ['POST', '/articles', 'articlesController.create'],
  ['PUT', '/articles/7', 'articlesController.update'],
  ['GET', '/tips', 'adminContentController.listTips'],
  ['POST', '/tips', 'tipsController.create'],
  ['PUT', '/tips/7', 'tipsController.update'],
  ['GET', '/tech-specs', 'adminContentController.listTechSpecs'],
  ['POST', '/tech-specs', 'techSpecsController.create'],
  ['PUT', '/tech-specs/7', 'techSpecsController.update'],
  ['GET', '/importers', 'importersController.list'],
];

const DELETE_ROUTES = [
  ['DELETE', '/articles/7', 'articlesController.remove'],
  ['DELETE', '/tips/7', 'tipsController.remove'],
  ['DELETE', '/tech-specs/7', 'techSpecsController.remove'],
  // Bulk import of fiches (created as drafts) is admin-only too.
  ['POST', '/tech-specs/import', 'techSpecsController.importBatch'],
];

const OTHER_ADMIN_ROUTES = [
  ['GET', '/stats'],
  ['GET', '/users'],
  ['PATCH', '/users/7/role'],
  ['GET', '/listings'],
  ['GET', '/newsletter'],
  ['PUT', '/site-settings/seo'],
  ['GET', '/importers/7'],
  ['POST', '/importers'],
];

test('a moderator can list, add and edit actualités, conseils and fiches techniques', async () => {
  for (const [method, url, handler] of MODERATOR_ROUTES) {
    const r = await call('mod', method, url);
    assert.equal(r.status, 200, `${method} ${url}`);
    assert.equal(r.body.handler, handler, `${method} ${url}`);
  }
});

test('a moderator cannot delete them', async () => {
  for (const [method, url] of DELETE_ROUTES) {
    const r = await call('mod', method, url);
    assert.equal(r.status, 403, `${method} ${url}`);
  }
});

test('a moderator gets 403 on every other admin route', async () => {
  for (const [method, url] of OTHER_ADMIN_ROUTES) {
    const r = await call('mod', method, url);
    assert.equal(r.status, 403, `${method} ${url}`);
  }
});

test('an admin keeps full access, deletion included', async () => {
  for (const [method, url, handler] of [...MODERATOR_ROUTES, ...DELETE_ROUTES]) {
    const r = await call('admin', method, url);
    assert.equal(r.status, 200, `${method} ${url}`);
    assert.equal(r.body.handler, handler, `${method} ${url}`);
  }
  for (const [method, url] of OTHER_ADMIN_ROUTES) {
    const r = await call('admin', method, url);
    assert.equal(r.status, 200, `${method} ${url}`);
  }
});

test('a plain user gets 403 everywhere, content routes included', async () => {
  for (const [method, url] of [...MODERATOR_ROUTES, ...DELETE_ROUTES, ...OTHER_ADMIN_ROUTES]) {
    const r = await call('user', method, url);
    assert.equal(r.status, 403, `${method} ${url}`);
  }
});

test('no token means 401', async () => {
  const res = await fetch(`${base}/articles`);
  assert.equal(res.status, 401);
});

test('GET /access tells the front which back-office to show', async () => {
  assert.deepEqual((await call('admin', 'GET', '/access')).body, { role: 'admin' });
  assert.deepEqual((await call('mod', 'GET', '/access')).body, { role: 'moderator' });
  assert.deepEqual((await call('both', 'GET', '/access')).body, { role: 'admin' });
  assert.equal((await call('user', 'GET', '/access')).status, 403);
});
