import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('article and guide cover photos load first, with no fade-in', () => {
  for (const [file, v] of [['components/ArticleDetails.tsx', 'article'], ['components/TipDetails.tsx', 'tip']]) {
    const s = read(file);
    const hero = s.slice(s.indexOf('{/* Featured Image */}'), s.indexOf('{/* Featured Image */}') + 900);
    assert.match(hero, new RegExp(`src=\\{${v}\\.image\\}[\\s\\S]*fetchPriority="high"`), file);
    assert.doesNotMatch(hero, /<Reveal/, file);
  }
  assert.match(read('api/og-prerender.ts'), /const coverPhoto = kind === 'article' \|\| kind === 'guide' \? String\(doc\.cover_image \|\| doc\.image \|\| ''\) : '';/);
});

test('the first model card on a brand page is not lazy', () => {
  assert.match(read('components/tech-specs/TechSpecModelCard.tsx'), /loading=\{priority \? 'eager' : 'lazy'\}/);
  assert.match(read('components/TechSpecsModels.tsx'), /priority=\{idx === 0\}/);
});
