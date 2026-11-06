import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../components/Hero.tsx', import.meta.url), 'utf8');
const wrapper = src.match(/Wrapper: "([^"]+)"/)?.[1] ?? '';

test('the home hero has minimum heights, never fixed ones: « Rechercher » is not cut off on tablets or small phones', () => {
  assert.match(wrapper, /\boverflow-hidden\b/);
  assert.match(wrapper, /min-h-\[calc\(var\(--vh,1vh\)\*100\)\] md:min-h-\[50vh\] lg:min-h-\[80vh\]/);
  assert.doesNotMatch(wrapper, /(^|\s)(md:|lg:)?h-\[/);
  // The content fills the hero through flex, not a percentage of an auto height.
  assert.match(src, /ContentWrapper: "relative z-10 flex-1 flex flex-col/);
});

test('the hero content clears the fixed header (72 px) at every width', () => {
  const text = src.match(/TextSection: "([^"]+)"/)?.[1] ?? '';
  assert.match(text, /\bpt-24\b/);
  assert.doesNotMatch(text, /md:pt-0/);
});

test('the live-count badge keeps its space while loading (no layout shift)', () => {
  assert.match(src, /liveCount === undefined \? \(\s*<div className=\{`\$\{S\.Badge\} invisible`\} aria-hidden="true">/);
});
