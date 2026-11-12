import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const news = readFileSync(new URL('../components/News.tsx', import.meta.url), 'utf8');

test('news list on phones: the category is a small 12 px label and the title (16 px) reads first', () => {
  // Phones force every button to 16 px (globals.css), so the label needs `!`.
  assert.match(news, /className="!text-\[12px\] leading-none font-bold text-primary-700 bg-primary-50 rounded-full/);
  assert.match(news, /<h4 className="text-\[16px\] font-\[800\]/);
  assert.doesNotMatch(news, /text-\[9px\] font-\[900\] text-primary-600 uppercase tracking-widest/);
});
