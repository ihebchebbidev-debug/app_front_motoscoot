import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

// The build (Vite/esbuild) does not type-check: a missing import ships and
// only fails in the visitor's browser. That happened on 2026-11-12, when a
// merge dropped `import { analytics }` from DepositAd.tsx and publishing a
// listing ended on an error after it was saved. TypeScript catches it.
test('TypeScript finds no error in the project', { timeout: 180_000 }, () => {
  let out = '';
  try {
    execSync('npx tsc --noEmit -p .', { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    out = String((e as { stdout?: string }).stdout || e);
  }
  assert.equal(out.split('\n').filter((l) => /error TS\d+/.test(l)).join('\n'), '');
});
