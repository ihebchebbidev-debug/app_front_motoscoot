import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SEO_SNAPSHOTS } from '../src/seo/snapshots';

// vercel.json serves some routes from a prerendered "<path>/index.html". That
// file only exists when src/seo/snapshots.ts lists the route: a rewrite
// without its snapshot answers 404 (it happened to /plan-du-site).
test('every route vercel.json serves from a prerendered index.html has a snapshot', () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const prerendered = (vercel.rewrites as { source: string; destination: string }[])
    .filter((r) => r.destination === `${r.source}/index.html`)
    .map((r) => r.source);
  assert.ok(prerendered.length > 5);
  const built = new Set(SEO_SNAPSHOTS.map((s) => s.path));
  assert.deepEqual(prerendered.filter((p) => !built.has(p)), []);
});

test('the sitemap page is prerendered', () => {
  const s = SEO_SNAPSHOTS.find((x) => x.path === '/plan-du-site');
  assert.ok(s);
  assert.match(s!.title, /Plan du site/);
});
