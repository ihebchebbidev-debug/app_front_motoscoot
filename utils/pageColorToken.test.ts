import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const tsx = (dir: string): string[] => readdirSync(join(root, dir)).flatMap((f) => {
  const p = join(dir, f);
  return statSync(join(root, p)).isDirectory() ? tsx(p) : p.endsWith('.tsx') ? [p] : [];
});

test('the phone page background is the « page » colour, never the literal #F8F9F9', () => {
  const css = readFileSync(join(root, 'src/styles/globals.css'), 'utf8');
  assert.match(css, /--page:\s+180 7\.7% 97\.5%;/); // = #F8F9F9, no visible change
  assert.match(readFileSync(join(root, 'tailwind.config.js'), 'utf8'), /page: 'hsl\(var\(--page\) \/ <alpha-value>\)'/);
  const left = tsx('components').filter((f) => /#F8F9F9/i.test(readFileSync(join(root, f), 'utf8')));
  assert.deepEqual(left, []);
});

test('the brand list uses the site greys only (no « slate »)', () => {
  assert.doesNotMatch(readFileSync(join(root, 'components/TechSpecsBrands.tsx'), 'utf8'), /slate-\d/);
});
