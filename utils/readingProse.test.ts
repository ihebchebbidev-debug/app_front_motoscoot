import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { READING_PROSE } from '../components/ui/readingProse';

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('reading styles: dark body text, underlined orange-700 links, weight 800 headings, orange bullets, upright quotes, winning over pasted inline colours', () => {
  assert.match(READING_PROSE, /prose-p:!text-gray-800/);
  assert.match(READING_PROSE, /prose-a:!text-orange-700 prose-a:font-semibold prose-a:underline/);
  assert.match(READING_PROSE, /prose-a:\[overflow-wrap:anywhere\]/);
  assert.match(READING_PROSE, /prose-headings:font-extrabold/);
  assert.match(READING_PROSE, /--tw-prose-bullets:theme\(colors\.primary\.600\)/);
  assert.match(READING_PROSE, /prose-blockquote:not-italic/);
  assert.doesNotMatch(READING_PROSE, /font-black|text-gray-600|text-gray-400/);
});

test('article and guide bodies use the shared reading styles and appear without a fade-in', () => {
  const article = read('components/ArticleDetails.tsx');
  const tip = read('components/TipDetails.tsx');
  assert.match(article, /\$\{READING_PROSE\} prose-lg md:prose-xl/);
  assert.match(tip, /\$\{READING_PROSE\} prose-lg/);
  assert.doesNotMatch(article, /<Reveal/);
  assert.doesNotMatch(tip, /<Reveal animation="fade-in-up">\s*<div className=\{`\$\{READING_PROSE\}/);
  assert.doesNotMatch(article, /text-gray-400|text-gray-300|font-\[900\]|\bitalic\b/);
});
