import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBatch, BATCH_MAX } from './techSpecBatch.ts';

const fiche = (over: Record<string, unknown> = {}) => ({
  brand: 'Yamaha', model: 'XMAX 300', year: 2026, category: 'Scooter', ...over,
});

test('reads a bare list and a { fiches } object', () => {
  const a = parseBatch(JSON.stringify([fiche()]));
  const b = parseBatch(JSON.stringify({ fiches: [fiche(), fiche({ model: 'TMAX' })] }));
  assert.ok(a.ok && a.rows.length === 1 && a.rows[0].label === 'Yamaha XMAX 300 2026');
  assert.ok(b.ok && b.fiches.length === 2);
});

test('refuses invalid JSON, a non-list, an empty or too big lot, in French', () => {
  for (const [raw, msg] of [
    ['{oops', /JSON valide/],
    ['{"brand":"Yamaha"}', /liste de fiches/],
    ['[]', /vide/],
    [JSON.stringify(Array.from({ length: BATCH_MAX + 1 }, () => fiche())), /trop gros/],
  ] as const) {
    const r = parseBatch(raw);
    assert.equal(r.ok, false);
    assert.match((r as { error: string }).error, msg);
  }
});

test('flags each fiche the server will refuse, and photos from outside our uploads', () => {
  const r = parseBatch(JSON.stringify([
    fiche(),
    fiche({ brand: '' }),
    fiche({ year: 'deux mille' }),
    fiche({ category: '' }),
    fiche({ image: '/uploads/abc.webp' }),
    fiche({ image: 'https://www.yamaha-motor.eu/x.jpg' }),
  ]));
  assert.ok(r.ok);
  assert.deepEqual(r.rows.map((x) => x.problem), [undefined, 'Marque manquante', 'Année invalide', 'Catégorie manquante', undefined, undefined]);
  assert.deepEqual(r.rows.map((x) => x.hasPhoto), [false, false, false, false, true, false]);
});
