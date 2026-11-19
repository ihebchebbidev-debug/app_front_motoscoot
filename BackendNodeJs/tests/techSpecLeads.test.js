/**
 * « Demande de devis » and importer counters (techSpecLeadsController.js).
 * Fake database and mailer, installed before the controller loads them.
 * Runner: node --test tests/techSpecLeads.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const calls = [];
let rowsFor = () => [];
const dbPath = require.resolve('../src/config/database');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true,
  exports: { query: async (sql, params) => { calls.push({ sql, params }); return { rows: rowsFor(sql, params) }; } } };
const mails = [];
const mailerPath = require.resolve('../src/services/mailer');
require.cache[mailerPath] = { id: mailerPath, filename: mailerPath, loaded: true,
  exports: { sendQuoteRequestEmails: async (o) => { mails.push(o); return { importer: true, admin: true, visitor: true }; } } };

const ctrl = require('../src/controllers/techSpecLeadsController');
const { validateQuote, csvCell } = ctrl._internals;

const res = () => { const r = { code: 200 }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = () => r; r.send = (b) => { r.body = b; return r; }; return r; };
const human = { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' };
const form = { first_name: 'Ali', last_name: 'Ben Salah', phone: '22 123 456', email: 'Ali@Example.tn', consent: true };
const SPEC = { id: 's1', brand: 'SYM', model: 'Jet 14', slug: 'sym-jet-14', image: null, price_new: '7099', importer_id: 'i1', importer_name: 'SODIV', importer_email: 'ventes@sodiv.tn', subscribed: true };

test('the form: names, phone, e-mail and the consent box are required', () => {
  assert.equal(validateQuote({ ...form, consent: false }).error, 'Merci d’accepter l’utilisation de vos coordonnées');
  assert.equal(validateQuote({ ...form, consent: 'true' }).error, 'Merci d’accepter l’utilisation de vos coordonnées'); // a real true only
  assert.match(validateQuote({ ...form, phone: '12' }).error, /téléphone/);
  assert.match(validateQuote({ ...form, email: 'x@y' }).error, /e-mail/);
  assert.match(validateQuote({ ...form, last_name: ' ' }).error, /Nom et prénom/);
  assert.deepEqual(validateQuote(form), { first_name: 'Ali', last_name: 'Ben Salah', phone: '22 123 456', email: 'ali@example.tn' });
  assert.ok(!validateQuote({ ...form, phone: '+216 22 123 456' }).error);
});

test('a quote is stored, counted and e-mailed when the importer is subscribed', async () => {
  calls.length = 0; mails.length = 0;
  rowsFor = (sql) => sql.includes('FROM tech_specs t LEFT JOIN importers') ? [SPEC]
    : sql.includes('AS by_ip') ? [{ by_ip: 0, same: 0 }]
    : sql.includes('INSERT INTO quote_requests') ? [{ id: 7 }] : [];
  const r = res();
  await ctrl.requestQuote({ params: { id: 's1' }, body: { ...form, session_id: 'abc' }, headers: human, ip: '1.2.3.4' }, r, (e) => { throw e; });
  assert.equal(r.code, 201);
  assert.equal(r.body.importer, 'SODIV');
  const ins = calls.find((c) => c.sql.includes('INSERT INTO quote_requests'));
  assert.deepEqual(ins.params.slice(0, 8), ['s1', 'i1', 'SYM', 'Jet 14', 'Ali', 'Ben Salah', '22 123 456', 'ali@example.tn']);
  assert.ok(calls.some((c) => c.sql.includes("VALUES ($1,$2,'quote',$3)")));
  await new Promise((ok) => setImmediate(ok));
  assert.equal(mails[0].importerEmail, 'ventes@sodiv.tn');
  assert.equal(mails[0].pageUrl, 'https://www.moto-scoot.tn/fiche-technique/sym-jet-14');
});

test('no quote for an importer without a running subscription; trap field and repeats answer quietly', async () => {
  rowsFor = (sql) => sql.includes('FROM tech_specs t LEFT JOIN importers') ? [{ ...SPEC, subscribed: false }] : [];
  let r = res();
  await ctrl.requestQuote({ params: { id: 's1' }, body: form, headers: human }, r, (e) => { throw e; });
  assert.equal(r.code, 409);

  calls.length = 0; r = res();
  await ctrl.requestQuote({ params: { id: 's1' }, body: { ...form, website: 'http://spam' }, headers: human }, r, (e) => { throw e; });
  assert.equal(r.code, 201);
  assert.equal(calls.length, 0); // nothing stored for a robot

  rowsFor = (sql) => sql.includes('FROM tech_specs t LEFT JOIN importers') ? [SPEC] : sql.includes('AS by_ip') ? [{ by_ip: 0, same: 1 }] : [];
  r = res();
  await ctrl.requestQuote({ params: { id: 's1' }, body: form, headers: human }, r, (e) => { throw e; });
  assert.equal(r.body.deduped, true);

  rowsFor = (sql) => sql.includes('FROM tech_specs t LEFT JOIN importers') ? [SPEC] : sql.includes('AS by_ip') ? [{ by_ip: 5, same: 0 }] : [];
  r = res();
  await ctrl.requestQuote({ params: { id: 's1' }, body: form, headers: human }, r, (e) => { throw e; });
  assert.equal(r.code, 429);
});

test('taps: call, whatsapp, compare only; robots and quick repeats are not counted', async () => {
  let r = res();
  await ctrl.trackLead({ params: { id: 's1' }, body: { kind: 'quote' }, headers: human }, r, (e) => { throw e; });
  assert.equal(r.code, 400); // a quote is counted only when sent

  r = res();
  await ctrl.trackLead({ params: { id: 's1' }, body: { kind: 'call' }, headers: { 'user-agent': 'Googlebot/2.1' } }, r, (e) => { throw e; });
  assert.equal(r.body.skipped, 'bot');

  rowsFor = (sql) => sql.includes('FROM tech_specs t LEFT JOIN importers') ? [SPEC] : sql.startsWith('SELECT 1 FROM lead_events') ? [{ '?column?': 1 }] : [];
  r = res();
  await ctrl.trackLead({ params: { id: 's1' }, body: { kind: 'whatsapp', session_id: 'abc' }, headers: human }, r, (e) => { throw e; });
  assert.equal(r.body.skipped, 'repeat');

  calls.length = 0;
  rowsFor = (sql) => sql.includes('FROM tech_specs t LEFT JOIN importers') ? [SPEC] : [];
  r = res();
  await ctrl.trackLead({ params: { id: 's1' }, body: { kind: 'compare', session_id: 'abc' }, headers: human }, r, (e) => { throw e; });
  assert.equal(r.code, 201);
  assert.deepEqual(calls.find((c) => c.sql.startsWith('INSERT INTO lead_events')).params, ['s1', 'i1', 'compare', 'abc']);
});

test('CSV cells: separators quoted, formulas defused', () => {
  assert.equal(csvCell('Ben; Salah'), '"Ben; Salah"');
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('+216 22 123 456'), "'+216 22 123 456");
});
