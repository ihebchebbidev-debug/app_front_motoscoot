import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HERO_ALT, LOGO_ALT } from '../config/heroDefaults';

// Owner, 2026-11-22: SE Ranking counted the home page's empty alt texts as
// « Alt text missing ». The hero photo and the logo are now described, with
// the same text in the first paint and in the app.
test('home hero photo and logo are described, same text in the first paint and in the app', () => {
  assert.ok(HERO_ALT.length > 10);
  assert.equal(LOGO_ALT, 'Moto-Scoot.tn');
  const shell = readFileSync(new URL('../src/seo/vitePluginSeoSnapshots.ts', import.meta.url), 'utf8');
  assert.match(shell, /logo-white\.svg" alt="\$\{escapeHtml\(LOGO_ALT\)\}"/);
  assert.match(shell, /mobile_url\)\}" alt="\$\{escapeHtml\(HERO_ALT\)\}"/);
  const hero = readFileSync(new URL('../components/Hero.tsx', import.meta.url), 'utf8');
  assert.match(hero, /alt=\{HERO_ALT\}/);
});
