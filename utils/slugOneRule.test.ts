import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { slugify } from './slugify';
import listingHandler from '../api/og-listing';
import detailHandler from '../api/og-prerender';

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const shell = '<html><head></head><body><div id="root"></div></body></html>';
function capture() {
  return { code: 0, headers: {} as Record<string, string>, body: '', setHeader(k: string, v: string) { this.headers[k] = v; return this; }, status(c: number) { this.code = c; return this; }, send(b: string) { this.body = b; return this; }, end() { return this; } };
}

// Titles whose slug used to differ between the app's links and the servers.
const TRAPS = ['Vends scooter Sym !', '« Yamaha » 125', 'Casque_LS2 neuf', '  Kymco   DINK-R  2026 ', 'Ténéré 700 — essai ?'];

test('slugs: no leading or trailing hyphen, ever', () => {
  for (const t of TRAPS) assert.doesNotMatch(slugify(t), /^-|-$/, t);
  assert.equal(slugify('Vends scooter Sym !'), 'vends-scooter-sym');
  assert.equal(slugify('« Yamaha » 125'), 'yamaha-125');
});

test('a listing link built by the app is the canonical: 200, never a 301', async () => {
  const original = globalThis.fetch;
  try {
    for (const title of TRAPS) {
      globalThis.fetch = async () => Response.json({ listing: { id: 'x', listing_number: 12, title, brand: 'SYM', model: 'Jet', year: 2025, price: 5000, images: [] } });
      const res = capture();
      await listingHandler({ query: { slugid: `${slugify(title)}-12` }, appShell: shell }, res);
      assert.equal(res.code, 200, `${title} → ${res.headers.Location}`);
    }
  } finally { globalThis.fetch = original; }
});

test('an article or guide link built by the app is the canonical: 200, never a 301', async () => {
  const original = globalThis.fetch;
  const id = '40c76738-43fe-49c8-84e2-482dd38f3c8d';
  try {
    for (const kind of ['article', 'guide'] as const) {
      for (const title of TRAPS) {
        globalThis.fetch = async (input) => String(input).includes(id) ? Response.json({ id, title, content: '<p>Texte.</p>', summary: 'Résumé' }) : Response.json([]);
        const res = capture();
        await detailHandler({ query: { kind, slugid: `${slugify(title)}-${id}` }, appShell: shell }, res);
        assert.equal(res.code, 200, `${kind} ${title} → ${res.headers.Location}`);
      }
    }
  } finally { globalThis.fetch = original; }
});

test('the servers have no slug rule of their own any more', () => {
  for (const f of ['api/og-listing.ts', 'api/og-prerender.ts']) {
    const src = read(f);
    assert.match(src, /import \{ slugify \} from '\.\.\/utils\/slugify\.js';/, f);
    assert.doesNotMatch(src, /const (front)?[sS]lugify = /, f);
  }
});

test('garage links carry name + city, like the garage canonical', () => {
  assert.match(read('utils/urlUtils.ts'), /case 'garage-details': path = `\/garage\/\$\{slugify\(\[slug, params\.city\]\.filter\(Boolean\)\.join\(' '\)\)\}-\$\{id\}`/);
  assert.match(read('components/Garages.tsx'), /onNavigate\?\.\('garage-details', \{ id: garage\.id, name: garage\.name, city: garage\.city \}\)/);
  assert.match(read('api/og-prerender.ts'), /slugify\(kind === 'garage' \? \[doc\.name, doc\.city\]\.filter\(Boolean\)\.join\(' '\)/);
});
