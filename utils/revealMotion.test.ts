import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reveal = readFileSync(new URL('../components/ui/Reveal.tsx', import.meta.url), 'utf8');

test('Reveal: only opacity and transform, and « reduce motion » gets a short fade without movement', () => {
  assert.doesNotMatch(reveal, /transition-all/);
  assert.match(reveal, /transition-\[opacity,transform\]/);
  assert.match(reveal, /motion-reduce:transform-none motion-reduce:\[transition-duration:150ms\] motion-reduce:\[transition-delay:0ms\]/);
  assert.match(reveal, /\['--reveal-ms' as string\]: `\$\{duration\}ms`/);
});
