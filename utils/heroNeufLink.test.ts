import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 2026-11-15, owner: the home « Neuf » tab must open
// https://www.moto-scoot.tn/fiches-techniques (no ?available_in_tunisia=true,
// which the server 301s to the clean URL anyway).

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('home « Neuf » tab opens /fiches-techniques without a filter', () => {
  const hero = read('../components/Hero.tsx');
  const line = hero.split('\n').find((l) => l.includes('onNeufClick='));
  assert.ok(line, 'Hero wires the Neuf tab');
  assert.match(line!, /onNeufClick=\{\(\) => onNavigate\?\.\('tech-specs-brands'\)\}/);
  // urlUtils imports images, so it cannot load under Node: read its route table.
  assert.ok(read('./urlUtils.ts').includes("case 'tech-specs-brands': path = '/fiches-techniques'; break;"));
});
