import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { privateShell } from '../src/seo/vitePluginSeoSnapshots';
import { DEPOSIT_TITLE, DEPOSIT_DESCRIPTION, SPA_TITLE } from '../src/seo/privatePages';
import { mergeDetailShell } from './detailHtml';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const deposit = readFileSync(new URL('../components/DepositAd.tsx', import.meta.url), 'utf8');

test('« Déposer une annonce »: its own title and description, out of Google', () => {
  const html = privateShell(index, DEPOSIT_TITLE, DEPOSIT_DESCRIPTION);
  assert.match(html, /<title>Déposer une annonce gratuite \| Moto-Scoot\.tn<\/title>/);
  assert.match(html, /<meta name="description" content="Vendez votre moto ou votre scooter en Tunisie/);
  assert.match(html, /<meta name="robots" content="noindex, follow" \/>/);
  assert.doesNotMatch(html, /name="googlebot"/);
  assert.doesNotMatch(html, /rel="canonical"/);
  assert.doesNotMatch(html, /Motos et Scooters en Tunisie \| Neufs &amp; Occasion|Motos et Scooters en Tunisie \| Neufs & Occasion/); // not the home title any more
  // React says the same once the app has loaded.
  assert.match(deposit, /<SEO title=\{DEPOSIT_TITLE\} rawTitle description=\{DEPOSIT_DESCRIPTION\} noIndex url="\/deposer-une-annonce" \/>/);
});

test('private app pages (/spa.html): noindex, not the home page title', () => {
  const html = privateShell(index, SPA_TITLE, 'x');
  assert.match(html, /<title>Moto-Scoot\.tn<\/title>/);
  assert.match(html, /<meta name="robots" content="noindex, follow" \/>/);
});

test('detail pages built on /spa.html stay indexable: their own robots line replaces the shell one', () => {
  const shell = privateShell(index, SPA_TITLE, 'x');
  const detail = '<html><head><title>SYM Jet 14</title><meta name="robots" content="index, follow" /></head><body><h1>SYM Jet 14</h1></body></html>';
  const page = mergeDetailShell(shell, detail);
  assert.doesNotMatch(page, /noindex/);
  assert.match(page, /<meta name="robots" content="index, follow" \/>/);
  assert.equal((page.match(/<title>/g) || []).length, 1);
  assert.match(page, /<title>SYM Jet 14<\/title>/);
});
