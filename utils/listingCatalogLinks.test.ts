import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchListingFiche, catalogBrand, listingCatalogLinks } from './listingCatalogLinks';
import listingHandler from '../api/og-listing';

// SEO audit of 2026-11-19, H3: a listing linked only to itself. It now links
// to the fiche of the same model (when there is one) and to its brand page,
// on the page and in the HTML Google receives.

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const SYM = [{ model: 'Jet 14 EVO 125', slug: 'sym-jet-14-evo-125' }, { model: 'Jet X 125', slug: 'sym-jet-x-125' }, { model: 'ADX 300', slug: 'sym-adx-300' }];
const KYMCO = [{ model: 'DINK-R 125 Tunnel', slug: 'kymco-dink-r-125-tunnel' }, { model: 'People S 125', slug: 'kymco-people-s-125' }];
const YAMAHA = [{ model: 'TMAX 560', slug: 'yamaha-tmax-560' }, { model: 'TMAX Tech MAX', slug: 'yamaha-tmax-tech-max' }];

test('a fiche is linked only when it is the same model', () => {
  assert.equal(matchListingFiche('JET X 125', SYM)?.slug, 'sym-jet-x-125', 'case and spacing ignored');
  assert.equal(matchListingFiche('DINK-R', KYMCO)?.slug, 'kymco-dink-r-125-tunnel', 'the fiche name continues the listing’s');
  assert.equal(matchListingFiche('Tmax 530 Iron', YAMAHA), null, 'never a neighbour model');
  assert.equal(matchListingFiche('Jet', SYM)?.slug, 'sym-jet-x-125', 'shortest fiche continuing the name');
  assert.equal(matchListingFiche('X', SYM), null, 'too short to tell');
  assert.equal(matchListingFiche('Jet X 125', [{ model: 'Jet X 125', slug: null }]), null, 'no address, no link');
});

test('brand page only for a brand of the catalogue; fiche first', () => {
  assert.equal(catalogBrand('sym', ['SYM', 'Kymco']), 'SYM');
  assert.equal(catalogBrand('Benelli', ['SYM']), null);
  assert.deepEqual(listingCatalogLinks({ brand: 'Kymco', model: 'DINK-R' }, ['Kymco'], KYMCO), [
    { kind: 'fiche', href: '/fiche-technique/kymco-dink-r-125-tunnel', label: 'Fiche technique Kymco DINK-R 125 Tunnel' },
    { kind: 'marque', href: '/fiches-techniques/kymco', label: 'Toutes les fiches Kymco' },
  ]);
  assert.deepEqual(listingCatalogLinks({ brand: 'Yamaha', model: 'Tmax 530 Iron' }, ['Yamaha'], YAMAHA).map((l) => l.kind), ['marque']);
  assert.deepEqual(listingCatalogLinks({ brand: 'Benelli', model: 'TRK 502' }, ['Yamaha'], []), []);
});

const capture = () => { const r: any = { code: 0, headers: {}, body: '' }; r.setHeader = (k: string, v: string) => { r.headers[k] = v; return r; }; r.status = (c: number) => { r.code = c; return r; }; r.send = (b: string) => { r.body = b; return r; }; r.end = () => r; return r; };

test('the HTML Google receives: breadcrumb, fiche and brand links', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (async (input: any) => {
      const u = String(input);
      if (u.endsWith('/listings/3')) return Response.json({ id: 3, listing_number: 3, title: 'Kymco DINK-R 2026', brand: 'Kymco', model: 'DINK-R', year: 2026, price: 10000, city: 'Tunis' });
      if (u.endsWith('/tech-specs/brands')) return Response.json([{ brand: 'Kymco', models_count: '2' }]);
      if (u.endsWith('/tech-specs/brands/Kymco')) return Response.json(KYMCO);
      return new Response('{}', { status: 404 });
    }) as typeof fetch;
    const r = capture();
    await listingHandler({ query: { slugid: 'kymco-dink-r-2026-3' }, appShell: '<html><head></head><body><div id="root"></div></body></html>' }, r);
    assert.equal(r.code, 200);
    assert.ok(r.body.includes('<a href="https://www.moto-scoot.tn/annonces">Annonces</a>'), 'breadcrumb');
    assert.ok(r.body.includes('<a href="https://www.moto-scoot.tn/fiche-technique/kymco-dink-r-125-tunnel">Fiche technique Kymco DINK-R 125 Tunnel</a>'));
    assert.ok(r.body.includes('<a href="https://www.moto-scoot.tn/fiches-techniques/kymco">Toutes les fiches Kymco</a>'));
    // Catalogue down: the listing still renders, without the block.
    globalThis.fetch = (async (input: any) => String(input).endsWith('/listings/3')
      ? Response.json({ id: 3, listing_number: 3, title: 'Kymco DINK-R 2026', brand: 'Kymco', model: 'DINK-R' })
      : new Response('{}', { status: 503 })) as typeof fetch;
    const down = capture();
    await listingHandler({ query: { slugid: 'kymco-dink-r-2026-3' }, appShell: '<html><head></head><body><div id="root"></div></body></html>' }, down);
    assert.equal(down.code, 200);
    assert.ok(!down.body.includes('Toutes les fiches'));
  } finally { globalThis.fetch = original; }
});

test('the page shows the same block, under the description', () => {
  assert.match(read('../components/ListingDetails.tsx'), /<ListingCatalogLinks brand=\{listing\.brand\} model=\{listing\.model\}/);
  assert.match(read('../components/listing/ListingCatalogLinks.tsx'), /listingCatalogLinks\(\{ brand, model \}, brands, specs\)/);
});
