import { test } from 'node:test';
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
});