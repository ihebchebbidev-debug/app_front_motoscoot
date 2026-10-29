import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Vercel runs api/* as native ES modules: relative imports without ".js" crash every detail page (500).
test('hosting page functions use .js extensions on relative imports', () => {
  for (const f of readdirSync('api').filter((n) => n.endsWith('.ts'))) {
    const src = readFileSync(`api/${f}`, 'utf8');
    const bad = [...src.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) => m[1]).filter((p) => !p.endsWith('.js'));
    assert.deepEqual(bad, [], `api/${f}`);
  }
});
