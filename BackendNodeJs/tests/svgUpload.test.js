/**
 * SVG uploads (brand logos in admin › Données réf.).
 *
 * Acceptance rules:
 *   1. /api/uploads accepts image/svg+xml (before: refused, "Only JPEG, PNG,
 *      WebP and GIF"), and refuses other formats with a French message (400).
 *   2. An SVG is never stored as SVG: it is drawn into a transparent WebP,
 *      sharp at logo size (longest side 1200 px even for a tiny viewBox),
 *      and its thumbnail is the whole logo (contain), never cropped.
 *   3. A booby-trapped SVG (script, onload, remote image) is drawn without
 *      running anything and without any network request.
 *   4. A broken or over-2 MB SVG gets a French 400, not a 500.
 *
 * Uses the real sharp (installed with the API's dependencies); skipped if
 * sharp cannot be loaded. Files written to uploads/ are removed afterwards.
 * Runner: node --test tests/svgUpload.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const Module = require('node:module');

const SRC = path.resolve(__dirname, '../src');
let sharp;
try { sharp = require('sharp'); } catch { sharp = null; }

const realLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  let resolved;
  try { resolved = Module._resolveFilename(request, parent, isMain); } catch { resolved = request; }
  if (resolved === path.join(SRC, 'utils/logger.js')) return { info() {}, warn() {}, error() {}, debug() {} };
  if (resolved === path.join(SRC, 'config/database.js')) return { query: async () => ({ rows: [] }) };
  return realLoad.apply(this, arguments);
};
const { isSvg, svgDensity } = require('../src/utils/svgImage');
const ctrl = sharp ? require('../src/controllers/uploadController') : null;
const { errorHandler } = require('../src/middlewares/errorHandler');
Module._load = realLoad;

const UPLOADS = path.resolve(__dirname, '../uploads');
const written = [];
test.after(() => {
  for (const f of written) fs.rmSync(f, { force: true });
});

const req = { protocol: 'https', get: () => 'api.test' };
async function save(buf, mimetype = 'image/svg+xml') {
  const r = await ctrl.compressAndSave(buf, 'logo.svg', req, mimetype);
  const main = path.join(UPLOADS, r.filename);
  const thumb = path.join(UPLOADS, 'thumbnails', path.basename(r.thumbnail_url));
  written.push(main, thumb);
  return { r, main, thumb };
}

const LOGO = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 24" width="64" height="24">' +
  '<rect x="2" y="2" width="60" height="20" rx="4" fill="#e8590c"/></svg>',
);

test('SVG is recognised by type or by content', () => {
  assert.equal(isSvg('image/svg+xml', null), true);
  assert.equal(isSvg('application/octet-stream', Buffer.from('﻿  <?xml version="1.0"?>\n<svg></svg>')), true);
  assert.equal(isSvg('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47])), false);
  assert.equal(svgDensity(64, 24), 1350);
  assert.equal(svgDensity(5000, 100), 72);
  assert.equal(svgDensity(1, 1), 2400);
});

test('the upload filter accepts SVG and refuses other formats in French', { skip: !sharp }, async () => {
  // multer keeps the filter on the instance (upload.fileFilter).
  const filter = (mimetype) => new Promise((resolve) => {
    ctrl.upload.fileFilter({}, { mimetype }, (e, ok) => resolve({ e, ok }));
  });
  const [svg, pdf] = await Promise.all([filter('image/svg+xml'), filter('application/pdf')]);
  assert.equal(svg.ok, true);
  assert.equal(pdf.ok, false);
  assert.equal(pdf.e.code, 'UNSUPPORTED_IMAGE_TYPE');
  assert.match(pdf.e.message, /JPEG, PNG, WebP, GIF ou SVG/);
});

test('a refused format answers 400 with the French message', () => {
  let status; let body;
  const res = { status(s) { status = s; return this; }, json(b) { body = b; return this; } };
  const e = Object.assign(new Error('Format non accepté : JPEG, PNG, WebP, GIF ou SVG.'), { code: 'UNSUPPORTED_IMAGE_TYPE' });
  errorHandler(e, { id: 'r1' }, res, () => {});
  assert.equal(status, 400);
  assert.match(body.error, /Format non accepté/);
});

test('a tiny-viewBox logo becomes a sharp, transparent WebP; thumbnail not cropped', { skip: !sharp }, async () => {
  const { r, main, thumb } = await save(LOGO);
  assert.match(r.url, /^\/uploads\/[0-9a-f-]+\.webp$/);
  const m = await sharp(main).metadata();
  assert.equal(m.format, 'webp');
  assert.equal(m.hasAlpha, true);
  assert.ok(Math.max(m.width, m.height) >= 1150, `drawn at logo size, got ${m.width}×${m.height}`);
  assert.ok(Math.abs(m.width / m.height - 64 / 24) < 0.05, 'proportions kept');
  const t = await sharp(thumb).metadata();
  assert.equal(t.width, 300);
  assert.equal(t.height, 300);
  // Corners of the "contain" thumbnail are transparent padding, not cropped logo.
  const { data, info } = await sharp(thumb).raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[info.channels - 1], 0, 'top-left pixel is transparent');
});

test('a booby-trapped SVG runs nothing and fetches nothing', { skip: !sharp }, async () => {
  let hits = 0;
  const server = http.createServer((_q, res) => { hits++; res.end('x'); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/pixel.png`;
  try {
    const evil = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 40" onload="alert(1)">' +
      '<script>fetch("' + url + '?script")</script>' +
      `<image href="${url}" xlink:href="${url}" width="100" height="40"/>` +
      '<rect width="100" height="40" fill="#123456"/></svg>',
    );
    const { main } = await save(evil);
    assert.equal((await sharp(main).metadata()).format, 'webp');
    const stored = fs.readFileSync(main);
    assert.equal(stored.includes(Buffer.from('<script')), false);
    assert.equal(stored.includes(Buffer.from('onload')), false);
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(hits, 0, 'no network request while drawing');
  } finally {
    server.close();
  }
});

test('broken or too heavy SVG: French 400, nothing written', { skip: !sharp }, async () => {
  await assert.rejects(ctrl.compressAndSave(Buffer.from('<svg><g></svg'), 'x.svg', req, 'image/svg+xml'),
    (e) => e.status === 400 && /SVG illisible/.test(e.message));
  const big = Buffer.concat([Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><!--'), Buffer.alloc(2 * 1024 * 1024, 'a'), Buffer.from('--></svg>')]);
  await assert.rejects(ctrl.compressAndSave(big, 'x.svg', req, 'image/svg+xml'),
    (e) => e.status === 400 && /2 Mo maximum/.test(e.message));
});

test('photos keep the same treatment as before (cover thumbnail)', { skip: !sharp }, async () => {
  const png = await sharp({ create: { width: 800, height: 400, channels: 3, background: '#336699' } }).png().toBuffer();
  const { main, thumb } = await save(png, 'image/png');
  const m = await sharp(main).metadata();
  assert.deepEqual([m.format, m.width, m.height], ['webp', 800, 400]);
  const t = await sharp(thumb).metadata();
  assert.deepEqual([t.width, t.height, t.hasAlpha], [300, 300, false]);
});
