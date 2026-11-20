/**
 * Importer subscription (« abonnement »): the fiche buttons Appel, WhatsApp
 * and Devis show only while importers.subscription_until >= today.
 * Runner: node --test tests/importerSubscription.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { subscribedSql, parseSubscriptionUntil } = require('../src/utils/importerSubscription');

test('read through to_jsonb: a server without the column reads « not subscribed », no SQL error', () => {
  assert.equal(subscribedSql('i'), "COALESCE((to_jsonb(i)->>'subscription_until')::date >= CURRENT_DATE, FALSE)");
});

test('the fiche payload tells whether its importer is subscribed', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/controllers/techSpecsController.js'), 'utf8');
  assert.match(src, /'subscribed', \$\{subscribedSql\('i'\)\}/);
});

test('admin date: empty clears it, YYYY-MM-DD kept, anything else refused', () => {
  assert.equal(parseSubscriptionUntil(''), null);
  assert.equal(parseSubscriptionUntil(null), null);
  assert.equal(parseSubscriptionUntil('2027-01-31'), '2027-01-31');
  assert.equal(parseSubscriptionUntil('2027-01-31T00:00:00.000Z'), '2027-01-31');
  assert.equal(parseSubscriptionUntil('31/01/2027'), undefined);
});

test('quote e-mails: from devis@, never from the visitor; the visitor in Reply-To; no password in code', () => {
  const mailer = fs.readFileSync(path.join(__dirname, '../src/services/mailer.js'), 'utf8');
  assert.match(mailer, /const QUOTE_SMTP_USER = process\.env\.QUOTE_SMTP_USER \|\| 'devis@moto-scoot\.tn';/);
  assert.match(mailer, /const QUOTE_SMTP_PASS = process\.env\.QUOTE_SMTP_PASS \|\| '';/);
  assert.match(mailer, /transport\.sendMail\(\{ from, to: opts\.importerEmail, replyTo, \.\.\.m \}\)/);
  const { _internals } = require('../src/services/mailer');
  const t = _internals.quoteRequestTemplate({ importerName: 'SODIV <b>', brand: 'SYM', model: 'Jet 14', firstName: 'A', lastName: 'B', phone: '22', email: 'a@b.tn' });
  assert.equal(t.subject, 'Demande de devis — SYM Jet 14 (via moto-scoot.tn)');
  assert.ok(t.html.includes('SODIV &lt;b&gt;'));
});

test('saving an importer never runs ALTER TABLE when the column already exists (production 500, 2026-11-20)', async () => {
  const calls = [];
  let columnExists = true;
  let alterFails = false;
  const dbPath = require.resolve('../src/config/database');
  const saved = require.cache[dbPath];
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query: async (sql) => {
    calls.push(sql);
    if (sql.includes('information_schema.columns')) return { rows: columnExists ? [{ '?column?': 1 }] : [] };
    if (sql.startsWith('ALTER TABLE') && alterFails) throw Object.assign(new Error('must be owner of table importers'), { code: '42501' });
    return { rows: [] };
  } } };
  const modPath = require.resolve('../src/utils/importerSubscription');
  delete require.cache[modPath];
  let mod = require('../src/utils/importerSubscription');
  await mod.ensureSubscriptionColumn();
  assert.ok(calls.some((c) => c.includes('information_schema.columns')));
  assert.ok(!calls.some((c) => c.startsWith('ALTER TABLE')), 'no ALTER when the column is there');

  // Missing column and no right to add it: a clear 503 for the admin, not a bare 500.
  delete require.cache[modPath];
  mod = require('../src/utils/importerSubscription');
  calls.length = 0; columnExists = false; alterFails = true;
  await assert.rejects(mod.ensureSubscriptionColumn(), (e) => e.status === 503 && /041_importers_subscription\.sql/.test(e.publicMessage));
  if (saved) require.cache[dbPath] = saved; else delete require.cache[dbPath];
  delete require.cache[modPath];
});
