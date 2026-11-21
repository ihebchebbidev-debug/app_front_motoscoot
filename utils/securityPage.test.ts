import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f: string) => readFileSync(f, 'utf8');

test('the five buyer reflexes are written once and shown on /securite and on every listing', () => {
  for (const f of ['components/Security.tsx', 'components/listing/ListingSidebar.tsx']) {
    assert.match(read(f), /BUYER_SAFETY_TIPS/, f);
  }
  assert.doesNotMatch(read('components/listing/ListingSidebar.tsx'), /const securityTips = \[/);
  assert.match(read('components/listing/ListingSidebar.tsx'), /to="\/securite"/);
});

test('/securite: same h1 as its crawler snapshot, buyers, sellers, Tunisian papers, scams, report', async () => {
  const src = read('components/Security.tsx');
  const { SEO_SNAPSHOTS } = await import('../src/seo/snapshots');
  const snap = SEO_SNAPSHOTS.find((s: { path: string }) => s.path === '/securite')!;
  assert.ok(src.includes(`title="${snap.h1}"`), 'h1 matches the snapshot');
  for (const h of ['Vous achetez', 'Vous vendez', 'Les papiers en Tunisie', 'Les arnaques les plus courantes', 'Un doute&nbsp;? Signalez-le']) {
    assert.ok(src.includes(h), h);
  }
  assert.match(src, /mutation à l'ATTT dans les 15 jours/);
  assert.doesNotMatch(snap.description, /transactions sécurisées/, 'no promise of a secure payment the site does not offer');
});

test('information pages share one hero and one key-points box', () => {
  for (const f of ['components/Terms.tsx', 'components/Security.tsx']) {
    const src = read(f);
    assert.match(src, /<InfoHero\b/, f);
    assert.match(src, /<KeyPoints\b/, f);
  }
});

test('French typography on /securite: no-break space inside « » and before : ? so no sign starts a line alone', () => {
  const src = read('components/Security.tsx');
  assert.doesNotMatch(src, /« |[^\s] »/, 'guillemets keep their no-break spaces');
  assert.match(read('constants/safetyTips.ts'), /«\\u00a0réserver\\u00a0»/);
});

test('both information pages use the shared sommaire', () => {
  for (const f of ['components/Terms.tsx', 'components/Security.tsx']) {
    assert.match(read(f), /<TocList items=\{SECTIONS\} \/>/, f);
    assert.match(read(f), /<FoldedToc items=\{SECTIONS\} \/>/, f);
  }
});
