import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { detailIdentifier, mergeDetailShell, scriptSafeJson } from './detailHtml';
import { resolveEditorial } from './publicContent';
import { publishedReviewAverage, verifiedReviewMarkup } from './reviewUtils';
import listingHandler from '../api/og-listing';
import detailHandler from '../api/og-prerender';

test('numeric-ending model and collision slugs resolve as the entire short slug', () => {
  for (const slug of ['honda-cb-500', 'sym-jet-14-evo-2024', 'sym-jet-14-evo-2024-2']) assert.equal(detailIdentifier('fiche-technique', slug), slug);
});
test('legacy UUID remains resolvable and numbered listing uses its number', () => {
  assert.equal(detailIdentifier('fiche-technique', 'sym-jet-14-evo-7a760d0c-56de-4da6-8279-23e5f6d7030e'), '7a760d0c-56de-4da6-8279-23e5f6d7030e');
  assert.equal(detailIdentifier('annonce', 'voge-900-blacknight-2024-1'), '1');
});
test('only explicitly verified genuine third-party rows enter review markup', () => {
  assert.deepEqual(verifiedReviewMarkup([{ rating: 5, author_name: 'A', content: 'Test' }]), {});
  const data = verifiedReviewMarkup([{ rating: 4, is_verified: true, author_name: 'A', content: 'Entretien effectué' }]);
  assert.equal(data.review?.[0].reviewRating.ratingValue, 4);
  assert.equal(data.aggregateRating?.reviewCount, 1);
  assert.equal(publishedReviewAverage([]), null);
});
test('editorial UUID fallback reads subsequent published pages and retries the stored slug', async () => {
  const missing = Object.assign(new Error('missing'), { status: 404 });
  const result = await resolveEditorial<{ id: string; slug?: string }>('target', async key => { if (key === 'target') throw missing; return { id: 'target', slug: key }; }, async page => ({ rows: page === 1 ? Array.from({ length: 100 }, (_, i) => ({ id: String(i) })) : [{ id: 'target', slug: 'chaine-moto' }], totalPages: 2 }));
  assert.equal(result.slug, 'chaine-moto');
});
test('editorial outages do not fall back as missing content', async () => {
  await assert.rejects(resolveEditorial('id', async () => { throw Object.assign(new Error('outage'), { status: 503 }); }, async () => { throw new Error('Must not fetch list'); }), /outage/);
});
test('detail content replaces homepage metadata without removing the application script', () => {
  const html = mergeDetailShell('<html><head><title>Home</title><link rel="canonical" href="/"></head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>', '<html><head><title>Voge</title><link rel="canonical" href="/annonce/voge-1"></head><body><h1>Voge</h1></body></html>');
  assert.ok(html.includes('/assets/app.js'));
  assert.ok(html.includes('<h1>Voge</h1>'));
  assert.equal(html.includes('<title>Home</title>'), false);
  assert.equal(scriptSafeJson({ content: '</script>' }).includes('</script>'), false);
});

function responseCapture() {
  return { code: 0, headers: {} as Record<string, string>, body: '', setHeader(key: string, value: string) { this.headers[key] = value; return this; }, status(code: number) { this.code = code; return this; }, send(body: string) { this.body = body; return this; }, end() { return this; } };
}
test('hosting returns 404 for missing listing and 503 for API outage, never generic 200', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('{}', { status: 404 });
    const missing = responseCapture();
    await listingHandler({ query: { slugid: 'voge-1' } }, missing);
    assert.equal(missing.code, 404);
    assert.equal(missing.body.includes('rel="canonical"'), false);
    globalThis.fetch = async () => new Response('{}', { status: 503 });
    const unavailable = responseCapture();
    await listingHandler({ query: { slugid: 'voge-1' } }, unavailable);
    assert.equal(unavailable.code, 503);
    assert.equal(unavailable.headers['Cache-Control'], 'no-store');
  } finally { globalThis.fetch = original; }
});
test('short sheet ending 500 fetches its full slug and renders original price without extra thousands', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async input => {
      assert.ok(String(input).endsWith('/tech-specs/honda-cb-500'));
      return Response.json({ id: 'abc', slug: 'honda-cb-500', brand: 'Honda', model: 'CB 500', price_new: 48000 });
    };
    const result = responseCapture();
    await detailHandler({ query: { kind: 'fiche-technique', slugid: 'honda-cb-500' }, appShell: '<html><head></head><body><div id="root"></div><script src="app.js"></script></body></html>' }, result);
    assert.equal(result.code, 200);
    assert.ok(result.body.includes('48 000 DT'));
    assert.equal(result.body.includes(',000 DT'), false);
  } finally { globalThis.fetch = original; }
});test('sheet engine size keeps its decimal point (124.7 cc, not 1247 cc)', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ id: 'abc', slug: 'sym-jet-14-evo-125', brand: 'SYM', model: 'Jet 14 EVO 125', year: 2026, category: 'Scooter', price_new: '9000', updated_at: '2026-11-01T19:54:01Z', engine: { cc: '124.7 cc', power: '12.6 ch' }, dimensions: { weight: '136 kg' } });
    const result = responseCapture();
    await detailHandler({ query: { kind: 'fiche-technique', slugid: 'sym-jet-14-evo-125' }, appShell: '<html><head></head><body><div id="root"></div><script src="app.js"></script></body></html>' }, result);
    assert.equal(result.code, 200);
    assert.equal(result.body.includes('1247'), false);
    assert.ok(result.body.includes('124,7'));
    assert.ok(result.body.includes('"value":124.7'));
  } finally { globalThis.fetch = original; }
});
test('sheet body gives crawlers one h1 with the brand, a dated price, a spec table and the brand link', async () => {
  const { renderFicheBody } = await import('../api/og-prerender');
  const html = renderFicheBody({ brand: 'SYM', model: 'Jet 14 EVO 125', price_new: '9000', updated_at: '2026-11-01T19:54:01Z', engine: { cc: '124.7 cc' }, dimensions: { weight: '136 kg' } });
  assert.equal(html.match(/<h1>/g)?.length, 1);
  assert.ok(html.includes('<h1>SYM Jet 14 EVO 125</h1>'));
  assert.ok(html.includes('prix relevé en novembre 2026'));
  assert.ok(html.indexOf('</table>') < html.indexOf('Son prix neuf'), 'summary comes after the spec table');
  assert.ok(html.includes('<th scope="row">Poids</th><td>136 kg</td>'));
  assert.ok(html.includes('/fiches-techniques/sym"'));
});
test('sheet price is a catalogue price, not a Moto-Scoot.tn offer in stock', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ id: 'abc', slug: 'honda-cb-500', brand: 'Honda', model: 'CB 500', price_new: 48000 });
    const result = responseCapture();
    await detailHandler({ query: { kind: 'fiche-technique', slugid: 'honda-cb-500' }, appShell: '<html><head></head><body><div id="root"></div></body></html>' }, result);
    assert.equal(result.body.includes('InStock'), false);
    assert.equal(result.body.includes('"seller"'), false);
  } finally { globalThis.fetch = original; }
});
test('listing emits one Product + Vehicle node, not two competing entities', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ listing: { id: 'x', listing_number: 3, title: 'Kymco DINK-R 2026', brand: 'Kymco', model: 'DINK-R', year: 2026, price: 10000, mileage: 11000, images: ['https://motoscoot.ihebchebbi.pro/uploads/a.webp'] } });
    const result = responseCapture();
    await listingHandler({ query: { slugid: 'kymco-dink-r-2026-3' }, appShell: '<html><head></head><body><div id="root"></div></body></html>' }, result);
    assert.equal(result.code, 200);
    assert.equal(result.body.match(/"@type":\["Product","Vehicle"\]/g)?.length, 1);
    assert.equal(result.body.includes('"@type":"Vehicle"'), false);
    assert.ok(result.body.includes('"value":11000'));
  } finally { globalThis.fetch = original; }
});
test('sheet title and description follow the agreed format in the crawler HTML', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ id: 'abc', slug: 'kymco-people-s-125', brand: 'Kymco', model: 'People S 125', year: 2025, price_new: 8500, engine: { cc: '124.6 cc', power: '11 ch' }, dimensions: { weight: '120 kg' } });
    const result = responseCapture();
    await detailHandler({ query: { kind: 'fiche-technique', slugid: 'kymco-people-s-125' }, appShell: '<html><head></head><body><div id="root"></div></body></html>' }, result);
    assert.ok(result.body.includes('<title>Kymco People S 125 | Prix en Tunisie &amp; Fiche Technique</title>'));
    assert.ok(result.body.includes(`<meta name="description" content="Prix de la Kymco People S 125 en Tunisie : ${(8500).toLocaleString('fr-FR')} DT. Fiche technique : 124,6 cm³, 11 ch, 120 kg. Comparez et choisissez votre moto." />`));
  } finally { globalThis.fetch = original; }
});
test('sheet description leaves out missing values and converts kW to ch', async () => {
  const { techSpecDescription, techSpecTitle } = await import('./techSpecSeo');
  assert.equal(techSpecTitle({ brand: 'SYM', model: 'Jet 14 EVO 125' }), 'SYM Jet 14 EVO 125 | Prix en Tunisie & Fiche Technique');
  assert.equal(techSpecDescription({ brand: 'Honda', model: 'X-ADV', cc: '745 cc' }), 'Fiche technique de la Honda X-ADV en Tunisie. Caractéristiques : 745 cm³. Comparez et choisissez votre moto.');
  assert.ok(techSpecDescription({ brand: 'Zontes', model: '125 X', price: '9 000 DT', power: '10 kW' }).includes('13,6 ch'));
  assert.equal(techSpecDescription({ brand: 'A', model: 'B', cc: 'N/A' }).includes('N/A'), false);
});
test('power stored as "15 ch (11 kW)" stays 15 ch', async () => {
  const { techSpecDescription } = await import('./techSpecSeo');
  assert.ok(techSpecDescription({ brand: 'QJ Motor', model: 'FORT 125 N', power: '15 ch (11 kW) à 8 500 tr/min' }).includes(': 15 ch.'));
});
test('scooter sheets read "Prix du … votre scooter", motorcycles keep "de la … votre moto"', async () => {
  const { techSpecDescription } = await import('./techSpecSeo');
  for (const category of ['Scooter', 'Maxi Scooter', 'Scooter / Adventure (ADV)']) {
    const d = techSpecDescription({ brand: 'SYM', model: 'Jet 14', category, price: 9000 });
    assert.ok(d.startsWith('Prix du SYM Jet 14 en Tunisie'), d);
    assert.ok(d.endsWith('votre scooter.'), d);
  }
  assert.ok(techSpecDescription({ brand: 'SYM', model: 'ADX 300', category: 'Scooter' }).startsWith('Fiche technique du SYM ADX 300'));
  for (const category of ['Roadster', 'Trail', 'Moto', 'MotoTrail adventure', undefined]) {
    const d = techSpecDescription({ brand: 'KTM', model: '390 Duke', category, price: 55000 });
    assert.ok(d.startsWith('Prix de la KTM 390 Duke en Tunisie'), d);
    assert.ok(d.endsWith('votre moto.'), d);
  }
});
test('admin category variants map to Scooter / Trail instead of Roadster', async () => {
  const { normalizeCategory: cat } = await import('./techSpecCategory');
  assert.equal(cat('Maxi Scooter'), 'Scooter');
  assert.equal(cat('Scooter / Adventure (ADV)'), 'Scooter');
  assert.equal(cat('MotoTrail adventure'), 'Trail');
  assert.equal(cat('Roadster'), 'Roadster');
  assert.equal(cat('Moto'), 'Roadster');
});
test('reading time comes from the text; articles and guides under 300 words are noindex, follow', async () => {
  const { readingTime, isThinContent, wordCount } = await import('./editorial');
  const long = '<p>' + 'mot '.repeat(2732) + '</p>';
  assert.equal(readingTime(long, 1), '14 min');
  assert.equal(readingTime('<p>Vingt-cinq mots seulement.</p>', 10), '1 min');
  assert.equal(readingTime('', 5), '5 min');
  assert.equal(wordCount('<p>Kit chaîne : l&#39;entretien</p>'), 4);
  assert.equal(isThinContent('mot '.repeat(299)), true);
  assert.equal(isThinContent('mot '.repeat(300)), false);
  const original = globalThis.fetch;
  try {
    for (const [words, robots] of [[25, 'noindex, follow'], [400, 'index, follow']] as const) {
      globalThis.fetch = async () => Response.json({ id: '7a760d0c-56de-4da6-8279-23e5f6d7030e', title: 'Permis A2', content: '<p>' + 'mot '.repeat(words) + '</p>' });
      const result = responseCapture();
      await detailHandler({ query: { kind: 'article', slugid: 'permis-a2-7a760d0c-56de-4da6-8279-23e5f6d7030e' }, appShell: '<html><head></head><body><div id="root"></div></body></html>' }, result);
      assert.equal(result.code, 200);
      assert.ok(result.body.includes(`<meta name="robots" content="${robots}`), `${words} words`);
    }
  } finally { globalThis.fetch = original; }
});
test('listing title and description are built from the listing data, not the raw ad text', async () => {
  const { listingTitle, listingDescription } = await import('./listingSeo');
  const kymco = { brand: 'Kymco', model: 'DINK-R', year: 2026, city: 'Tunis', price: 10000, mileage: 11000, cc: 125, condition: 'État neuf', type: 'Scooter' };
  const n = (x: number) => x.toLocaleString('fr-FR');
  assert.equal(listingTitle(kymco), `Kymco DINK-R 2026 d'occasion à Tunis – ${n(10000)} DT`);
  assert.equal(listingDescription(kymco), `Scooter Kymco DINK-R 2026 d'occasion à vendre à Tunis : ${n(10000)} DT, ${n(11000)} km, 125 cm³. Contactez directement le vendeur sur Moto-Scoot.tn.`);
  assert.equal(listingTitle({ brand: 'SYM', model: 'Jet 14', price: '9 000 DT', mileage: '0 km', condition: 'Neuf' }), `SYM Jet 14 neuf en Tunisie – ${n(9000)} DT`);
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ listing: { id: 'x', listing_number: 3, title: 'Kymco DINK-R 2026', ...kymco, description: 'À VENDRE ... Curieux s\'abstenir' } });
    const result = responseCapture();
    await listingHandler({ query: { slugid: 'kymco-dink-r-2026-3' }, appShell: '<html><head></head><body><div id="root"></div></body></html>' }, result);
    assert.ok(result.body.includes(`<title>Kymco DINK-R 2026 d&#39;occasion à Tunis – ${n(10000)} DT</title>`));
    assert.equal(/<meta name="description"[^>]*Curieux/.test(result.body), false);
  } finally { globalThis.fetch = original; }
});
test('robots.txt: AI crawlers share the private-path rules and nothing re-allows them', () => {
  const txt = readFileSync('public/robots.txt', 'utf8');
  const groups = txt.split(/\n(?=User-agent:)/);
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot']) {
    const group = groups.find((g) => new RegExp(`^User-agent: ${bot}$`, 'm').test(g));
    assert.ok(group, bot);
  }
  const lines = txt.split('\n').filter((l) => /^(User-agent|Allow|Disallow):/.test(l));
  assert.equal(lines.some((l) => l === 'Allow: /'), false);
  const firstRule = lines.findIndex((l) => !l.startsWith('User-agent'));
  assert.equal(lines.slice(firstRule).some((l) => l.startsWith('User-agent')), false, 'one group only');
  assert.ok(lines.includes('Disallow: /admin') && lines.includes('Disallow: /api/'));
});
test('internal guide links use the canonical slug (no trailing dash before the id)', async () => {
  const { slugify } = await import('./slugify');
  assert.equal(slugify('Comment bien graisser son kit chaîne ?'), 'comment-bien-graisser-son-kit-chaine');
  assert.equal(slugify('« Essai » Honda'), 'essai-honda');
});
test('listing HTML preloads the first gallery photo at the exact URL the gallery requests', async () => {
  const { seoImagePath } = await import('./seoImagePath');
  assert.equal(seoImagePath('https://motoscoot.ihebchebbi.pro/uploads/a.webp', 'Kymco DINK-R 2026'), '/m/kymco-dink-r-2026/a.webp');
  assert.equal(seoImagePath('/uploads/thumbnails/a.webp', 'Kymco DINK-R 2026'), '/m/kymco-dink-r-2026/t/a.webp');
  assert.equal(seoImagePath('https://cdn.example.com/a.webp', 'Kymco'), null);
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ listing: { id: 'x', listing_number: 3, title: 'Kymco DINK-R 2026', brand: 'Kymco', model: 'DINK-R', price: 10000, images: ['https://motoscoot.ihebchebbi.pro/uploads/first.webp', 'https://motoscoot.ihebchebbi.pro/uploads/second.webp'] } });
    const result = responseCapture();
    await listingHandler({ query: { slugid: 'kymco-dink-r-2026-3' }, appShell: '<html><head><link rel="preload" as="image" href="/hero.webp"></head><body><div id="root"></div></body></html>' }, result);
    assert.ok(result.body.includes('<link rel="preload" as="image" href="/m/kymco-dink-r-2026/first.webp" fetchpriority="high" />'));
    assert.equal(result.body.includes('/hero.webp'), false, 'home hero preload is dropped');
  } finally { globalThis.fetch = original; }
});
test('article body for crawlers keeps headings, paragraphs and lists, with every text escaped', async () => {
  const { crawlerBodyHtml, demoteBodyH1, realAuthorName } = await import('./editorial');
  const html = crawlerBodyHtml('<h1>Top 125</h1><p>Le <strong>SYM Jet 14</strong> coûte 9&nbsp;000 DT.</p><ul><li>Fiable</li><li>Sobre &amp; léger</li></ul><h3 class="x">Budget</h3><p><img src=x onerror=alert(1)>&lt;script&gt;</p>');
  assert.equal(html, '<h2>Top 125</h2>\n<p>Le SYM Jet 14 coûte 9 000 DT.</p>\n<ul>\n<li>Fiable</li>\n<li>Sobre &amp; léger</li>\n</ul>\n<h3>Budget</h3>\n<p>&lt;script&gt;</p>');
  assert.equal(demoteBodyH1('<h1 class="a">T</h1><h2>U</h2>'), '<h2 class="a">T</h2><h2>U</h2>');
  assert.equal(realAuthorName('Admin Admin'), null);
  assert.equal(realAuthorName('Mehdi Jelliti'), 'Mehdi Jelliti');
});
test('article prerender: author from the byline, organization for placeholder accounts, full body', async () => {
  const original = globalThis.fetch;
  try {
    for (const [author, expected] of [['Mehdi Jelliti', '"author":{"@type":"Person","name":"Mehdi Jelliti"}'], ['Admin Admin', '"author":{"@type":"Organization","@id":"https://www.moto-scoot.tn/#organization"']] as const) {
      globalThis.fetch = async () => Response.json({ id: '7a760d0c-56de-4da6-8279-23e5f6d7030e', title: 'Meilleures 125', author_name: author, content: '<h1>Intro</h1>' + '<p>mot mot mot mot mot</p>'.repeat(200) + '<h2>Fin</h2><p>dernier paragraphe</p>' });
      const result = responseCapture();
      await detailHandler({ query: { kind: 'article', slugid: 'meilleures-125-7a760d0c-56de-4da6-8279-23e5f6d7030e' }, appShell: '<html><head></head><body><div id="root"></div></body></html>' }, result);
      assert.ok(result.body.includes(expected), author);
      assert.ok(result.body.includes('<p>dernier paragraphe</p>'), 'full body, not cut at 4000 characters');
      assert.equal(result.body.match(/<h1>/g)?.length, 1);
    }
  } finally { globalThis.fetch = original; }
});
test('fiche summary is the same sentence for the crawler HTML and the React page', async () => {
  const { techSpecSummary } = await import('./techSpecSeo');
  const sentence = techSpecSummary({ brand: 'SYM', model: 'Jet 14 EVO 125', year: 2026, categoryLabel: 'Scooter', cc: '124.7 cc', power: '12.6 ch', price: '9 000 DT', updatedAt: '2026-11-01T19:54:01Z', importerName: 'Megacycle', importerCity: 'Sousse' });
  assert.equal(sentence, `SYM Jet 14 EVO 125 (2026) : scooter 125 cm³ équipé d’un moteur de 124,7 cm³ développant 12,6 ch. Son prix neuf en Tunisie est d’environ ${(9000).toLocaleString('fr-FR')} DT (prix relevé en novembre 2026). Le modèle est distribué en Tunisie par Megacycle, basé à Sousse.`);
  const { renderFicheBody } = await import('../api/og-prerender');
  assert.ok(renderFicheBody({ brand: 'SYM', model: 'Jet 14 EVO 125', year: 2026, category: 'Scooter', engine: { cc: '124.7 cc', power: '12.6 ch' }, price_new: '9000', updated_at: '2026-11-01T19:54:01Z', importer: { name: 'Megacycle', city: 'Sousse' } } as any).includes(`<p>${sentence}</p>`));
});
test('build-time snapshots mark their JSON-LD as server-side', () => {
  const src = readFileSync('src/seo/vitePluginSeoSnapshots.ts', 'utf8');
  assert.ok(src.includes('<script type="application/ld+json" data-ssr-ld>'));
});
test('power shown in ch everywhere: "9.3 kW (12.6 ch) à 8000 tr/min" is 12,6 ch, not 9.3 cv', async () => {
  const { formatPowerCh, techSpecSummary } = await import('./techSpecSeo');
  assert.equal(formatPowerCh('9.3 kW (12.6 ch) à 8000 tr/min'), '12,6 ch');
  assert.equal(formatPowerCh('43,5 ch à 8 000 tr/min'), '43,5 ch');
  assert.equal(formatPowerCh('15 cv'), '15 ch');
  assert.equal(formatPowerCh(''), '');
  assert.ok(techSpecSummary({ brand: 'SYM', model: 'Jet X 125', power: '9.3 kW (12.6 ch) à 8000 tr/min' }).includes('développant 12,6 ch.'));
});
test('server JSON-LD wins for the types it describes; types it lacks are still added', async () => {
  const { jsonLdTypes, schemasMissingFromServer } = await import('./jsonLdTypes');
  const server = jsonLdTypes([{ '@type': 'BreadcrumbList' }, { '@graph': [{ '@type': ['Product', 'Vehicle'] }] }]);
  assert.deepEqual([...server].sort(), ['BreadcrumbList', 'Product', 'Vehicle']);
  const page = [{ '@type': 'BreadcrumbList' }, { '@type': 'ItemList' }, { '@type': 'Vehicle' }];
  assert.deepEqual(schemasMissingFromServer(page, server), [{ '@type': 'ItemList' }]);
  assert.equal(schemasMissingFromServer(page, new Set()).length, 3);
});
test('one site name: og:site_name is "Moto-Scoot.tn" in every page source', () => {
  for (const f of ['index.html', 'api/og-listing.ts', 'api/og-prerender.ts', 'src/seo/vitePluginSeoSnapshots.ts']) {
    const names = [...readFileSync(f, 'utf8').matchAll(/og:site_name" content="([^"$]+)"/g)].map((m) => m[1]);
    assert.ok(names.length > 0, f);
    assert.deepEqual([...new Set(names)], ['Moto-Scoot.tn'], f);
  }
});
test('brand name is "Moto-Scoot.tn": no "MotoScoot" left in what the site shows or declares', () => {
  const files = ['index.html', 'api/og-listing.ts', 'api/og-prerender.ts', 'src/seo/snapshots.ts', 'src/seo/vitePluginSeoSnapshots.ts', 'components/common/SEO.tsx', 'utils/editorial.ts', 'utils/listingSeo.ts', 'hooks/useSearchSEO.ts', 'components/Footer.tsx', 'public/llms.txt', 'public/404.html'];
  for (const f of files) assert.equal(/(?<![A-Za-z@#])MotoScoot(?![A-Za-z])/.test(readFileSync(f, 'utf8')), false, f);
});
test('fiche summary: whole-number displacement is not repeated, missing parts are left out', async () => {
  const { techSpecSummary } = await import('./techSpecSeo');
  assert.equal(techSpecSummary({ brand: 'Zontes', model: '125 X', year: 2026, categoryLabel: 'Moto', cc: '125 cc', power: '15 cv' }), 'Zontes 125 X (2026) : moto 125 cm³ développant 15 ch.');
  assert.equal(techSpecSummary({ brand: 'Voge', model: '625', categoryLabel: 'Moto', cc: '581.2 cc' }), 'Voge 625 : moto 581 cm³ équipée d’un moteur de 581,2 cm³.');
  assert.ok(techSpecSummary({ brand: 'KTM', model: '390 Duke', categoryLabel: 'Roadster', cc: '398.7', price: 55000, importerName: 'SIMCC' }).endsWith('Le modèle est distribué en Tunisie par SIMCC.'));
});
test('fiche spec table starts with the dated new price (crawler HTML), and has no price row without a price', async () => {
  const { renderFicheBody } = await import('../api/og-prerender');
  const priced = renderFicheBody({ brand: 'SYM', model: 'Jet 14 EVO 125', price_new: '9000', updated_at: '2026-11-01T19:54:01Z', engine: { cc: '124.7 cc' } } as any);
  const firstRow = priced.match(/<tr>.*?<\/tr>/)?.[0];
  assert.equal(firstRow, `<tr><th scope="row">Prix neuf en Tunisie</th><td>${(9000).toLocaleString('fr-FR')} DT (relevé en novembre 2026)</td></tr>`);
  const unpriced = renderFicheBody({ brand: 'Honda', model: 'X-ADV', engine: { cc: '745 cc' } } as any);
  assert.equal(unpriced.includes('Prix neuf en Tunisie'), false);
});

test('brand page preloads the first card image and embeds the models', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (input: any) => String(input).includes('/tech-specs/brands/')
      ? Response.json([{ id: 'abc', slug: 'sym-jet-14-evo-125', brand: 'SYM', model: 'Jet 14 EVO 125', year: 2026, image: 'https://motoscoot.ihebchebbi.pro/uploads/a.webp' }])
      : Response.json([{ brand: 'SYM', models_count: 1 }]);
    const result = responseCapture();
    await detailHandler({ query: { kind: 'marque', slugid: 'sym' }, appShell: '<html><head><link rel="preload" as="image" href="/hero.webp"></head><body><div id="root"></div></body></html>' }, result);
    assert.equal(result.code, 200);
    assert.ok(result.body.includes('<link rel="preload" as="image" href="/m/sym-jet-14-evo-125-2026/a.webp" fetchpriority="high" />'));
    assert.equal(result.body.includes('/hero.webp'), false);
    const embedded = result.body.match(/<script>window\.__TECH_SPEC_BRAND__=(.*?)<\/script>/)?.[1];
    assert.ok(embedded);
    assert.equal(JSON.parse(embedded).name, 'SYM');
    assert.equal(JSON.parse(embedded).models[0].slug, 'sym-jet-14-evo-125');
  } finally { globalThis.fetch = original; }
});

test('sheet prerender embeds the API document and preloads the first gallery photo', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ id: 'abc', slug: 'sym-jet-14-evo-125', brand: 'SYM', model: 'Jet 14 EVO 125', year: 2026, image: '/uploads/cover.webp', gallery: ['/uploads/g1.webp', '/uploads/g2.webp'], engine: { cc: '124.7 cc' } });
    const result = responseCapture();
    await detailHandler({ query: { kind: 'fiche-technique', slugid: 'sym-jet-14-evo-125' }, appShell: '<html><head></head><body><div id="root"></div></body></html>' }, result);
    const embedded = result.body.match(/<script>window\.__TECH_SPEC__=(.*?)<\/script>/)?.[1];
    assert.ok(embedded);
    assert.equal(JSON.parse(embedded).slug, 'sym-jet-14-evo-125');
    assert.ok(result.body.includes('<link rel="preload" as="image" href="/m/sym-jet-14-evo-125-2026/g1.webp" fetchpriority="high" />'));
  } finally { globalThis.fetch = original; }
});
