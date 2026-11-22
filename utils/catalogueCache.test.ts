import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATALOGUE_CACHE } from '../api/og-prerender';

// Owner, 2026-11-22: Googlebot waited 2,0 s on the first visit of a sheet
// (x-vercel-cache: MISS) and 0,11 s on the next. The cached copy expired after
// 1 hour, and Google visits each sheet less often than that.

test('catalogue pages: fresh 10 minutes, then served from cache at once for up to 7 days', () => {
  assert.equal(CATALOGUE_CACHE, 'public, s-maxage=600, stale-while-revalidate=604800');
});

test('sheets, brand pages, sheet hub and the 125 price guide use it; listings keep the short window', () => {
  const api = readFileSync(new URL('../api/og-prerender.ts', import.meta.url), 'utf8');
  for (const fn of ['renderBrand', 'renderHub', 'renderScooter125']) {
    const body = api.slice(api.indexOf(`async function ${fn}(`));
    const next = body.indexOf('\nasync function ', 1);
    assert.match(next > 0 ? body.slice(0, next) : body, /res\.setHeader\('Cache-Control', CATALOGUE_CACHE\)/, fn);
  }
  assert.match(api, /res\.setHeader\('Cache-Control', kind === 'fiche-technique' \? CATALOGUE_CACHE : 'public, s-maxage=600, stale-while-revalidate=3600'\)/);
  assert.equal((api.match(/stale-while-revalidate=3600/g) || []).length, 1);
});
