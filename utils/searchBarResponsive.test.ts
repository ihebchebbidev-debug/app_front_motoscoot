import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../components/search/SearchBar.tsx', import.meta.url), 'utf8');

test('one toolbar row only from xl (1280 px); a 12-column grid on tablets', () => {
  assert.match(src, /md:grid md:grid-cols-12 xl:grid-cols-\[1\.5fr_1\.05fr_1\.05fr_0\.9fr_0\.9fr_1\.4fr_auto\]/);
  assert.doesNotMatch(src, /md:grid-cols-\[1\.5fr/);
});

test('tablet spans: 4/4/4, then 4/3/5 + full-width button (md), 3/2/4/3 (lg)', () => {
  for (const cls of [
    'className="md:col-span-4 xl:col-span-1"',
    'className="md:col-span-4 lg:col-span-3 xl:col-span-1"',
    'className="md:col-span-3 lg:col-span-2 xl:col-span-1"',
    'className="md:col-span-5 lg:col-span-4 xl:col-span-1"',
    'md:col-span-12 lg:col-span-3 xl:col-span-1',
  ]) assert.ok(src.includes(cls), cls);
  // Fields may shrink in the tablet grid, keep their natural width on the one-row toolbar.
  assert.match(src, /className=\{`relative max-xl:min-w-0 \$\{className\}`\}/);
  // Full-width button (phones, tablets) carries the result count.
  assert.match(src, /<span className="lg:hidden">Rechercher/);
});
