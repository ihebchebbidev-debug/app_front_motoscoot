import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAnalyticsExcludedPath } from '../services/analytics';

// Owner, 2026-11-19: /admin must not be counted in Google Analytics (79
// « organic » sessions in 28 days were the team's own visits). The
// admin-only API tester (/test) is left out too; public pages are unchanged.

test('back-office addresses are excluded, public ones are not', () => {
  for (const p of ['/admin', '/admin/', '/admin?tab=seo', '/admin/annonces', '/test', '/test/'])
    assert.equal(isAnalyticsExcludedPath(p), true, p);
  for (const p of ['/', '/annonces', '/fiches-techniques', '/fiche-technique/sym-jet-14-evo-125', '/administration-moto', '/tests-moto', '/article/test-yamaha-12', ''])
    assert.equal(isAnalyticsExcludedPath(p), false, p);
});

test('page views and events check the address before reaching gtag', () => {
  const src = readFileSync(new URL('../services/analytics.ts', import.meta.url), 'utf8');
  assert.match(src, /export function trackPageView[\s\S]*?if \(isAnalyticsExcludedPath\(path\)\) return;\n  window\.gtag\('event', 'page_view'/);
  assert.match(src, /export function trackEvent[\s\S]*?if \(isAnalyticsExcludedPath\(window\.location\.pathname\)\) return;\n  window\.gtag\('event', name, params\);/);
});
