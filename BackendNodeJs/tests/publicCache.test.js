/**
 * Short public cache on anonymous reads (src/middlewares/publicCache.js):
 *   1. Anonymous GET on public content gets Cache-Control + Vary: Authorization.
 *   2. Requests with a Bearer token, per-user routes, writes, errors and
 *      routes that set their own Cache-Control are left untouched.
 *
 * Runner: node --test tests/publicCache.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { publicCache, isCacheable, PUBLIC_CACHE_CONTROL } = require('../src/middlewares/publicCache');

function app() {
  const a = express();
  a.use('/api', publicCache);
  a.get('/api/listings', (_req, res) => res.json([]));
  a.get('/api/listings/favorites', (_req, res) => res.json([]));
  a.get('/api/tech-specs/missing', (_req, res) => res.status(404).json({ error: 'Not found' }));
  a.get('/api/site-settings', (_req, res) => { res.set('Cache-Control', 'public, max-age=300'); res.json({}); });
  a.get('/api/tips/:slug', (_req, res) => res.json({}));
  return a;
}

async function get(path, headers = {}) {
  const server = app().listen(0);
  try {
    const { port } = server.address();
    return await new Promise((resolve, reject) => {
      http.get({ port, path, headers }, (res) => { res.resume(); res.on('end', () => resolve(res)); }).on('error', reject);
    });
  } finally { server.close(); }
}

test('anonymous GET on public content is cached briefly and varies on Authorization', async () => {
  for (const path of ['/api/listings', '/api/tips/chaine-moto']) {
    const res = await get(path);
    assert.equal(res.headers['cache-control'], PUBLIC_CACHE_CONTROL, path);
    assert.match(res.headers.vary || '', /Authorization/);
  }
});

test('logged-in, per-user, error and self-managed responses are not touched', async () => {
  assert.equal((await get('/api/listings', { Authorization: 'Bearer x' })).headers['cache-control'], undefined);
  assert.equal((await get('/api/listings/favorites')).headers['cache-control'], undefined);
  assert.equal((await get('/api/tech-specs/missing')).headers['cache-control'], undefined);
  assert.equal((await get('/api/site-settings')).headers['cache-control'], 'public, max-age=300');
});

test('only reads on public prefixes qualify', () => {
  const req = (method, path, headers = {}) => ({ method, path, headers });
  assert.equal(isCacheable(req('POST', '/listings')), false);
  assert.equal(isCacheable(req('GET', '/listings/12/stats')), false);
  assert.equal(isCacheable(req('GET', '/tips/bookmarks')), false);
  assert.equal(isCacheable(req('GET', '/users/me')), false);
  assert.equal(isCacheable(req('GET', '/tech-specs/popular')), true);
});
