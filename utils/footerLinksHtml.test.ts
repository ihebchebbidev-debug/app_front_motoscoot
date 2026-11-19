import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FOOTER_INFO_LINKS, footerLinksHtml } from './footerLinks';
import { mergeDetailShell } from './detailHtml';

// Technical audit 2026-11-19: the 7 trust pages had no link Google could follow
// without JavaScript (the footer is drawn by React only). The footer's links
// are now in every HTML Google receives, from the list the footer itself uses.

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const TRUST = ['/a-propos', '/contact', '/faq', '/securite', '/mentions-legales', '/conditions', '/cookies'];

test('every trust page is a footer link, plus the sitemap page', () => {
  const html = footerLinksHtml();
  for (const p of [...TRUST, '/plan-du-site']) assert.ok(html.includes(`<a href="${p}">`), p);
  assert.ok(html.includes('<a href="/a-propos">À propos de nous</a>'));
  assert.ok(!footerLinksHtml('/faq').includes('href="/faq"'), 'no link to the page itself');
});

test('fiches, brands, listings and articles (rendered pages) carry the footer', () => {
  const merged = mergeDetailShell('<html><head><title>x</title></head><body><div id="root"></div></body></html>', '<html><head></head><body><h1>Fiche</h1></body></html>');
  assert.ok(merged.includes('<h1>Fiche</h1>'));
  for (const p of TRUST) assert.ok(merged.includes(`<a href="${p}">`), p);
});

test('pages built at deploy carry it too, and the visible footer uses the same list', () => {
  assert.match(read('../src/seo/vitePluginSeoSnapshots.ts'), /\$\{footerLinksHtml\(snap\.path\)\}/);
  assert.match(read('../components/Footer.tsx'), /FOOTER_INFO_LINKS\.map\(\(l\) => <FooterLink key=\{l\.view\} view=\{l\.view\}>\{l\.label\}<\/FooterLink>\)/);
  assert.match(read('../components/Footer.tsx'), /<FooterLink view="contact">Contact<\/FooterLink>/);
  assert.equal(FOOTER_INFO_LINKS.length, 7);
});
