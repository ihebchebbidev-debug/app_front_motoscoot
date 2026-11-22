import test from 'node:test';
import assert from 'node:assert/strict';
import { CLAUDE_ARTICLE_PROMPT, importArticleJsonLd } from './articleJsonLd';

const post = { '@type': 'BlogPosting', headline: 'Essai à Tunis', articleBody: '<h2>En ville</h2><p>Prise en main.</p>' };
const parse = (value: unknown) => importArticleJsonLd(JSON.stringify(value), html => html);

test('a Claude article fills editable fields and starts as an unfeatured draft', () => {
  const result = parse({ ...post, description: 'Essai urbain.', articleSection: 'essais', keywords: ['Tunisie', 'moto, Tunisie'],
    image: [{ '@type': 'ImageObject', url: 'https://example.org/moto.jpg' }], is_published: true, is_featured: true, author: 'Claude' });
  assert.deepEqual(result, { title: post.headline, content: post.articleBody, summary: 'Essai urbain.', category: 'Essais', tags: 'Tunisie, moto',
    image: 'https://example.org/moto.jpg', read_time: 1, is_published: false, is_featured: false });
});

test('pasted code fences, a JSON-LD script and a graph select the article and its declared image', () => {
  const graph = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', name: 'Moto-Scoot.tn' },
    { ...post, '@type': ['https://schema.org/NewsArticle'], image: { '@id': '#cover' } },
    { '@id': '#cover', '@type': 'ImageObject', contentUrl: '/uploads/moto.webp' },
  ] };
  const wrapped = '\uFEFF```html\n<script type="application/ld+json">' + JSON.stringify(graph) + '</script>\n```';
  assert.equal(importArticleJsonLd(wrapped, html => html).image, '/uploads/moto.webp');
  assert.equal(parse([post]).category, 'Nouveautés');
});

test('plain text preserves paragraphs, line breaks and literal comparisons', () => {
  const result = parse({ ...post, articleBody: 'Comparaison : 1 < 2 & 3.\nSuite.\n\nDeuxième paragraphe.' });
  assert.equal(result.content, '<p>Comparaison : 1 &lt; 2 &amp; 3.<br>Suite.</p><p>Deuxième paragraphe.</p>');
});

test('the importer validates sanitized content and never imports publishing metadata', () => {
  assert.throws(() => importArticleJsonLd('oops', x => x), /JSON invalide/);
  assert.throws(() => parse({ '@type': 'Product' }), /Type attendu/);
  assert.throws(() => parse([post, post]), /un seul article/);
  assert.throws(() => parse({ ...post, headline: '  ' }), /titre/);
  assert.throws(() => parse({ ...post, articleBody: '', description: 'Seulement le résumé' }), /articleBody/);
  assert.throws(() => importArticleJsonLd(JSON.stringify(post), () => ''), /texte lisible/);
  assert.equal(parse({ ...post, image: 'invalid' }).image, '');
});

test('the example embedded in the Claude prompt can be imported as written', () => {
  const example = CLAUDE_ARTICLE_PROMPT.match(/\n(\{[\s\S]*?\n\})\n/)![1];
  assert.equal(importArticleJsonLd(example, html => html).category, 'Scooters');
});
