import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ficheSlugCandidates, hasTunisiaParam, RENAMED_FICHES } from './legacyRedirects';

const handler = readFileSync(new URL('../api/og-prerender.ts', import.meta.url), 'utf8');
const footer = readFileSync(new URL('../components/Footer.tsx', import.meta.url), 'utf8');

test('a renamed sheet and its legacy address point to the new slug', () => {
  assert.equal(RENAMED_FICHES['honda-x-adv'], 'honda-x-adv-750');
  assert.deepEqual(ficheSlugCandidates('honda-x-adv'), ['honda-x-adv-750']);
  assert.deepEqual(ficheSlugCandidates('honda-x-adv-2026-93ba1b99-bcc3-4cb3-b8e4-8ab176a362e3'), ['honda-x-adv-750', 'honda-x-adv']);
  // A legacy address of a sheet that was not renamed: try its short slug.
  assert.deepEqual(ficheSlugCandidates('sym-jet-x-125-2025-07592e88-2499-435f-a372-08f172976f5b'), ['sym-jet-x-125']);
  // An unknown short slug has nowhere to go: stays a 404.
  assert.deepEqual(ficheSlugCandidates('modele-inexistant-zzz'), []);
});

test('the Tunisia parameter on a brand page is detected', () => {
  assert.equal(hasTunisiaParam({ kind: 'marque', slugid: 'qj-motor', available_in_tunisia: 'true' }), true);
  assert.equal(hasTunisiaParam({ kind: 'marque', slugid: 'qj-motor' }, '/fiches-techniques/qj-motor?available_in_tunisia=true'), true);
  assert.equal(hasTunisiaParam({ kind: 'marque', slugid: 'qj-motor' }, '/api/og-prerender?kind=marque&slugid=qj-motor'), false);
  assert.equal(hasTunisiaParam(undefined), false);
});

test('the handler redirects instead of answering 404 or a duplicate', () => {
  assert.match(handler, /import \{ ficheSlugCandidates, hasTunisiaParam \} from '\.\.\/utils\/legacyRedirects\.js';/); // .js: Vercel ES modules
  assert.match(handler, /if \(hasTunisiaParam\(req\.query, req\.url\)\) \{\s+res\.setHeader\('Location', `\$\{SITE\}\/fiches-techniques\/\$\{slugid/);
  assert.match(handler, /for \(const candidate of ficheSlugCandidates\(cleanSlugid\)\)/);
});

test('every public page has a link from the footer (no orphan)', () => {
  assert.match(footer, /<FooterLink view="security">Sécurité<\/FooterLink>/);
  assert.match(footer, /<FooterLink view="sitemap">Plan du site<\/FooterLink>/);
});

test('old English and old guide addresses redirect permanently (vercel.json)', () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const redirects = vercel.redirects as { source: string; destination: string; permanent?: boolean }[];
  const to = (src: string) => redirects.find((r) => r.source === src);
  assert.deepEqual(to('/tech-specs'), { source: '/tech-specs', destination: '/fiches-techniques', permanent: true });
  assert.deepEqual(to('/tech-specs/:brand'), { source: '/tech-specs/:brand', destination: '/fiches-techniques/:brand', permanent: true });
  // /conseils/<uuid> only: /conseils itself stays the guides list.
  const guide = redirects.find((r) => r.source.startsWith('/conseils/:id('));
  assert.ok(guide && guide.permanent && guide.destination === '/guide/:id');
  assert.ok(new RegExp('^/conseils/' + guide!.source.slice('/conseils/:id'.length) + '$').test('/conseils/1b220407-0481-414e-9d1e-57b4b5ad66b2'));
  assert.ok(!redirects.some((r) => r.source === '/conseils'));
  // No redirect may shadow a live route.
  for (const r of redirects) assert.ok(!/^\/(fiches-techniques|fiche-technique|guide|annonces?)(\/|$)/.test(r.source), r.source);
});
