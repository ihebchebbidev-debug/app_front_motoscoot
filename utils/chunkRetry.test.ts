import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isChunkLoadError, failedAssetUrl, mayReload } from './chunkRetry';

test('recognises a page file that failed to load, in every browser', () => {
  assert.ok(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://www.moto-scoot.tn/assets/TechSpecsModels-CCKvz_4v.js'))); // Chrome
  assert.ok(isChunkLoadError(new TypeError('Importing a module script failed.'))); // Safari / iPhone
  assert.ok(isChunkLoadError(new TypeError('error loading dynamically imported module: https://www.moto-scoot.tn/assets/A-1.js'))); // Firefox
  assert.ok(isChunkLoadError(new Error('Unable to preload CSS for /assets/FilterBar-x.css'))); // Vite
  assert.ok(!isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')")));
  assert.ok(!isChunkLoadError(null));
});

test('finds the file to fetch again', () => {
  assert.equal(failedAssetUrl(new TypeError('Failed to fetch dynamically imported module: https://www.moto-scoot.tn/assets/TechSpecsModels-CCKvz_4v.js')), 'https://www.moto-scoot.tn/assets/TechSpecsModels-CCKvz_4v.js');
  assert.equal(failedAssetUrl(new Error('Unable to preload CSS for /assets/FilterBar-x.css')), '/assets/FilterBar-x.css');
  assert.equal(failedAssetUrl(new TypeError('Importing a module script failed.')), null);
});

test('one reload per 10 s, never a loop', () => {
  assert.equal(mayReload(100_000, 0), true);
  assert.equal(mayReload(100_000, 95_000), false);
  assert.equal(mayReload(100_000, 89_000), true);
});

test('the global boundary reloads the asked page instead of going home', () => {
  const b = readFileSync(new URL('../components/ui/ErrorBoundary.tsx', import.meta.url), 'utf8');
  const i = b.indexOf('isChunkLoadError(this.state.error) && reloadForCurrentVersion(this.state.error)');
  assert.ok(i > 0);
  assert.ok(i < b.indexOf("window.location.assign('/')")); // checked before the home fallback
});
