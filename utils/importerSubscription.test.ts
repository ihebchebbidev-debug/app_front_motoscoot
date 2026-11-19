import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { subscriptionStatus, leadsLine } from './importerSubscription';

const tab = readFileSync(new URL('../components/admin/ImportersTab.tsx', import.meta.url), 'utf8');
const today = new Date('2026-11-19T10:00:00Z');

test('subscription badge: running, ending within 14 days, ended, none', () => {
  assert.deepEqual(subscriptionStatus('2027-01-31', today), { tone: 'on', label: "Jusqu'au 31/01/2027" });
  assert.deepEqual(subscriptionStatus('2026-11-25', today), { tone: 'soon', label: 'Expire le 25/11/2026' });
  assert.equal(subscriptionStatus('2026-11-19', today).tone, 'soon'); // the last day still counts
  assert.deepEqual(subscriptionStatus('2026-11-18', today), { tone: 'off', label: 'Expiré le 18/11/2026' });
  assert.deepEqual(subscriptionStatus(null, today), { tone: 'none', label: 'Aucun' });
});

test('contacts line: plural, zeros left out', () => {
  assert.equal(leadsLine({ calls: 12, whatsapp_taps: 5, quotes: 1, compares: 1 }), '12 appels · 5 WhatsApp · 1 devis · 1 comparaison');
  assert.equal(leadsLine({ calls: 0, whatsapp_taps: 0, quotes: 0, compares: 0 }), 'Aucun contact');
});

test('admin importers: end date in the form, badge and 30-day contacts in the list, stats panel', () => {
  assert.match(tab, /<input type="date" value=\{form\.subscription_until\}/);
  assert.match(tab, /subscription_until: f\.subscription_until \|\| null,/);
  assert.match(tab, /columns=\{\['Importateur', 'Ville', 'Contact', 'Abonnement', 'Contacts \(30 j\)', 'Statut', 'Actions'\]\}/);
  assert.match(tab, /<ImporterLeadsPanel key=\{statsFor\.id\}/);
});
