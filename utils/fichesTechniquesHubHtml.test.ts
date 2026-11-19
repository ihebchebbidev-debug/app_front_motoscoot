import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderHubHtml } from '../api/og-prerender';

// SEO audit of /fiches-techniques (2026-11-19), P7: the hub HTML was written at
// build time, so 6 brands added since (Vespa: 9 models) were missing from what
// Google received. It is now rendered at each request from the API, like the
// brand pages, with the texts of the React page.

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const NBSP = String.fromCharCode(0xa0);
const ROWS = [
  { brand: 'SYM', modelsCount: 9 }, { brand: 'Vespa', modelsCount: 9 }, { brand: 'Moto Guzzi', modelsCount: 2 },
  { brand: 'Uniscoot', modelsCount: 1 },
];

test('every brand of the API is a link in the HTML, with the page texts', () => {
  const html = renderHubHtml(ROWS, new Date('2026-11-19'));
  for (const [slug, name] of [['sym', 'SYM'], ['vespa', 'Vespa'], ['moto-guzzi', 'Moto Guzzi'], ['uniscoot', 'Uniscoot']])
    assert.match(html, new RegExp(`<a href="/fiches-techniques/${slug}">${name} : prix et fiches techniques</a>`), name);
  assert.match(html, /<title>Prix des motos et scooters en Tunisie 2026 : fiches techniques \| Moto-Scoot\.tn<\/title>/);
  assert.match(html, /<h1>Prix des motos et scooters en Tunisie<\/h1>/);
  assert.ok(html.includes(`<p>4${NBSP}marques · 21${NBSP}modèles</p>`));
  assert.match(html, /<meta name="description" content="Prix du neuf et fiches techniques de 21 motos et scooters de 4 marques en Tunisie/);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.moto-scoot\.tn\/fiches-techniques" \/>/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.match(html, /<a href="\/annonces">/, 'section links kept');
  assert.doesNotMatch(html, /href="\/fiches-techniques"/, 'no link to itself');
});

test('Vercel and the Node server send /fiches-techniques to that renderer', () => {
  const vercel = JSON.parse(read('../vercel.json'));
  const rule = vercel.rewrites.find((r: { source: string }) => r.source === '/fiches-techniques');
  assert.equal(rule.destination, '/api/og-prerender?kind=fiches-techniques');
  assert.match(read('../server.ts'), /const hub = \/\^\\\/fiches-techniques\\\/\?\$\/\.test\(req\.path\);/);
  assert.match(read('../api/og-prerender.ts'), /if \(\(kind as string\) === 'fiches-techniques'\) \{\n\s+await renderHub\(req, res\);/);
  // No build-time file any more, which could be served instead.
  assert.doesNotMatch(read('../src/seo/snapshots.ts'), /path: '\/fiches-techniques'/);
});
