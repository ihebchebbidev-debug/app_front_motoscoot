import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// A merge conflict on an import line resolved by keeping both sides leaves the
// same module imported twice (#127 + #128, #129 + #130). Vercel still built it,
// but TypeScript fails and the next bundler update may not forgive it.
const files = [
  ...readdirSync(new URL('../api/', import.meta.url)).filter((f) => f.endsWith('.ts')).map((f) => `api/${f}`),
  'server.ts',
];

test('no server file imports the same module twice (merge-conflict leftovers)', () => {
  for (const file of files) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const modules = [...src.matchAll(/^import[^;]*?from ['"]([^'"]+)['"]/gms)].map((m) => m[1]);
    const twice = modules.filter((m, i) => modules.indexOf(m) !== i);
    assert.deepEqual(twice, [], `${file} imports twice: ${twice.join(', ')}`);
  }
});
