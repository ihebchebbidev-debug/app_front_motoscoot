import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 2026-11-14, owner: « remove breadcrumb from résultat des annonces uniquement
// dans la version smartphone ». Desktop keeps it; Google keeps the JSON-LD.

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('/annonces shows its breadcrumb from 768 px only', () => {
  const page = read('../components/SearchResults.tsx');
  const crumbs = page.split('\n').filter((l) => l.includes('<PageBreadcrumb '));
  assert.equal(crumbs.length, 1, 'one visible breadcrumb');
  assert.match(crumbs[0], /className="hidden md:flex"/);
});

test('the BreadcrumbList structured data stays on /annonces', () => {
  const seo = read('../hooks/useSearchSEO.ts');
  assert.match(seo, /"@type": "BreadcrumbList"/);
});
