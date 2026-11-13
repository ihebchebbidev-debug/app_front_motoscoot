import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextPhoneSort } from './phoneSort';

// 2026-11-13, owner: on phones the sort showed « 2 tris » (several boxes
// ticked, only the first applied). Phones now pick ONE sort in a sheet.

test('a phone sort choice replaces the previous one (no « 2 tris »)', () => {
  assert.deepEqual(nextPhoneSort('price_asc', ['recent']), ['price_asc']);
  assert.deepEqual(nextPhoneSort('km_asc', ['price_asc']), ['km_asc']);
});

test('with « Autour de moi » on, the radius keeps filtering behind the visible sort', () => {
  assert.deepEqual(nextPhoneSort('price_asc', ['proximity']), ['price_asc', 'proximity']);
  assert.deepEqual(nextPhoneSort('recent', ['price_asc', 'proximity']), ['recent', 'proximity']);
  assert.deepEqual(nextPhoneSort('proximity', ['price_asc', 'proximity']), ['proximity']);
});

test('phones use the sort sheet; tablets and desktop keep the sort menu', () => {
  const page = readFileSync(new URL('../components/SearchResults.tsx', import.meta.url), 'utf8');
  const phoneBlock = page.slice(page.indexOf('<div className={S.MobileActions}>'), page.indexOf('<div className="hidden md:flex'));
  assert.match(phoneBlock, /<PhoneSortSheet/);
  assert.doesNotMatch(phoneBlock, /<SortDropdown/);
  const wideBlock = page.slice(page.indexOf('<div className="hidden md:flex'));
  assert.match(wideBlock, /<SortDropdown/);
});
