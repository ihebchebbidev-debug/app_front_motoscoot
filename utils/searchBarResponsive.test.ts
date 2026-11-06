import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../components/search/SearchBar.tsx', import.meta.url), 'utf8');

test('one toolbar row only from xl (1280 px); a 12-column grid on tablets', () => {
  assert.match(src, /md:grid md:grid-cols-12 md:gap-2\.5 xl:flex xl:gap-2/);
  assert.doesNotMatch(src, /md:grid-cols-\[1\.5fr/);
});

test('tablet spans: 4/4/4, then 4/3/5 + full-width button (md), 3/2/4/3 (lg)', () => {
  for (const cls of [
    'className="md:col-span-4 xl:flex-none"',
    'className="md:col-span-4 xl:flex-[1_1_auto] xl:min-w-[110px]"',
    'className="md:col-span-4 lg:col-span-3 xl:flex-none"',
    'className="md:col-span-3 lg:col-span-2 xl:flex-none"',
    'className="md:col-span-5 lg:col-span-4 xl:flex-[1_0_auto] xl:max-w-[260px]"',
    'md:col-span-12 lg:col-span-3 xl:flex-none',
  ]) assert.ok(src.includes(cls), cls);
  // Fields may shrink in the tablet grid, keep their natural width on the one-row toolbar.
  assert.match(src, /className=\{`relative min-w-0 \$\{className\}`\}/);
  // Full-width button (phones, tablets) carries the result count.
  assert.match(src, /<span className="lg:hidden">Rechercher/);
  // On the one-row toolbar the button keeps its own width (w-full would push it out).
  assert.match(src, /className="w-full xl:w-auto mt-3/);
});

test('a long chosen value is cut with an ellipsis (full text in the tooltip), never widening the row', () => {
  assert.match(src, /title=\{isDisabled \? undefined : display \|\| undefined\}/);
  assert.match(src, /className=\{`relative min-w-0 \$\{className\}`\}/);
  // The clear cross replaces the arrow once a value is chosen.
  assert.match(src, /\{!\(hasValue && onClear\) && \(\s*<button/);
});
