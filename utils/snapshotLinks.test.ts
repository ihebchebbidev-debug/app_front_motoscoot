import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SECTION_LINKS, brandLinks, linkBlocksFor, renderLinkBlocks } from '../src/seo/snapshotLinks';
import { SEO_SNAPSHOTS } from '../src/seo/snapshots';

const plugin = readFileSync(new URL('../src/seo/vitePluginSeoSnapshots.ts', import.meta.url), 'utf8');
const BRANDS = ['SYM', 'QJ Motor', 'Peugeot', 'Sym', 'Autre', ''];

test('the entry pages link to every section of the site, never to themselves', () => {
  assert.deepEqual(SECTION_LINKS.map((l) => l.href), ['/annonces', '/fiches-techniques', '/prix/scooter-125-tunisie', '/comparateur', '/actualites', '/conseils']);
  const annonces = linkBlocksFor('/annonces')[0];
  assert.equal(annonces.heading, 'Rubriques');
  assert.ok(!annonces.links.some((l) => l.href === '/annonces'));
  assert.equal(annonces.links.length, 5);
  assert.equal(linkBlocksFor('/')[0].links.length, 6);
});

test('brand links: one per brand, the address of the brand page', () => {
  assert.deepEqual(brandLinks(BRANDS), [
    { href: '/fiches-techniques/peugeot', label: 'Peugeot : prix et fiches techniques' },
    { href: '/fiches-techniques/qj-motor', label: 'QJ Motor : prix et fiches techniques' },
    { href: '/fiches-techniques/sym', label: 'SYM : prix et fiches techniques' },
  ]);
});

test('brands are listed on the pages that show them, and only when the API answered', () => {
  for (const p of ['/', '/fiches-techniques', '/comparateur']) assert.equal(linkBlocksFor(p, { brands: BRANDS })[1].heading, 'Marques');
  assert.equal(linkBlocksFor('/actualites', { brands: BRANDS }).length, 1);
  assert.equal(linkBlocksFor('/fiches-techniques', { brands: [] }).length, 1); // API down: section links only
});

test('the HTML is a plain list of escaped links', () => {
  const html = renderLinkBlocks(linkBlocksFor('/fiches-techniques', { brands: ['SYM', 'A&B <x>'] }));
  assert.match(html, /<nav aria-label="Rubriques"><h2>Rubriques<\/h2><ul><li><a href="\/annonces">/);
  assert.match(html, /<a href="\/fiches-techniques\/sym">SYM : prix et fiches techniques<\/a>/);
  assert.match(html, /A&amp;B &lt;x&gt;/);
  assert.doesNotMatch(html, /href="\/fiches-techniques"/); // no link to itself
});

test('every section link is a page that exists, and the plugin writes the blocks', () => {
  const paths = new Set(SEO_SNAPSHOTS.map((s) => s.path));
  for (const l of SECTION_LINKS) assert.ok(paths.has(l.href) || l.href.startsWith('/prix/'), l.href);
  assert.match(plugin, /\$\{renderLinkBlocks\(linkBlocksFor\(snap\.path, data\)\)\}/);
  assert.match(plugin, /const data: SnapshotData = \{ brands: await fetchBrands\(\) \};/);
});
