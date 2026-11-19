import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { subscriptionStatus, leadsLine, dailyTotals, reportSummary, extendSubscription, daysLeft } from './importerSubscription';

const tab = readFileSync(new URL('../components/admin/ImportersTab.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../components/admin/ImporterLeadsPanel.tsx', import.meta.url), 'utf8');
const today = new Date('2026-11-19T10:00:00Z');

test('subscription badge: running, ending within 14 days, ended, none; days left', () => {
  assert.deepEqual(subscriptionStatus('2027-01-31', today), { tone: 'on', label: "Jusqu'au 31/01/2027" });
  assert.deepEqual(subscriptionStatus('2026-11-25', today), { tone: 'soon', label: 'Expire le 25/11/2026' });
  assert.equal(subscriptionStatus('2026-11-19', today).tone, 'soon'); // the last day still counts
  assert.deepEqual(subscriptionStatus('2026-11-18', today), { tone: 'off', label: 'Expiré le 18/11/2026' });
  assert.deepEqual(subscriptionStatus(null, today), { tone: 'none', label: 'Aucun' });
  assert.equal(daysLeft('2026-11-25', today), 6);
  assert.equal(daysLeft('2026-11-19', today), 0);
  assert.equal(daysLeft('2026-11-18', today), null);
});

test('quick durations add months from the later of today and the current end', () => {
  assert.equal(extendSubscription('', 1, today), '2026-12-19');
  assert.equal(extendSubscription('2027-01-31', 1, today), '2027-02-28'); // end of a shorter month
  assert.equal(extendSubscription('2026-10-01', 12, today), '2027-11-19'); // expired: from today
});

test('one bar per day, zeros included; the summary to send the importer', () => {
  const bars = dailyTotals([{ day: '2026-11-18', n: 2 }, { day: '2026-11-18', n: 1 }, { day: '2026-11-19', n: 4 }], 7, today);
  assert.equal(bars.length, 7);
  assert.deepEqual(bars.slice(-2).map((b) => [b.day, b.n]), [['2026-11-18', 3], ['2026-11-19', 4]]);
  assert.equal(bars[0].n, 0);
  const text = reportSummary('Megacycle', 30, { calls: 12, whatsapp_taps: 1, quotes: 3, compares: 0 },
    [{ brand: 'SYM', model: 'Jet 14', calls: 9, whatsapp_taps: 1, quotes: 2, compares: 0 }, { brand: 'SYM', model: 'Orbit', calls: 3, whatsapp_taps: 0, quotes: 1, compares: 0 }]);
  assert.equal(text, 'Megacycle — 30 derniers jours sur Moto-Scoot.tn\n• 12 appels\n• 1 message WhatsApp\n• 3 demandes de devis\n• 0 comparaison\nModèle le plus demandé : SYM Jet 14');
  assert.equal(leadsLine({ calls: 0, whatsapp_taps: 0, quotes: 0, compares: 0 }), 'Aucun contact');
});

test('admin importers: subscription block with quick durations, icon counters, « Rapport » drawer', () => {
  assert.match(tab, /<legend className="px-1 text-\[11px\] font-bold text-slate-600">Abonnement<\/legend>/);
  assert.match(tab, /extendSubscription\(form\.subscription_until, m as number\)/);
  assert.match(tab, /aria-label="Contacts des 30 derniers jours"/);
  assert.match(tab, /aria-label=\{`Rapport de \$\{i\.name\}`\}><BarChart3 size=\{14\} aria-hidden="true" \/>Rapport<\/button>/);
  assert.match(tab, /\['Abonnés actifs', overview\.active\]/);
  // Same drawer as the visitor detail, same StatCard as the overview; Esc and focus handled.
  assert.match(panel, /role="dialog"\s+aria-modal="true"\s+aria-labelledby="importer-report-title"/);
  assert.match(panel, /<StatCard icon=\{Phone\} label="Appels"/);
  assert.match(panel, /if \(e\.key === 'Escape'\) onClose\(\);/);
  assert.match(panel, /Copier le résumé/);
});
