import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toGa4Event } from './ga4Events';

// Owner, 2026-11-21: contact clicks never reached GA4 (0 key events). Every
// buyer → seller contact is now one GA4 event, `contact_vendeur`, with the
// channel in `methode`; deposits are `annonce_publiee`.

test('each contact channel becomes contact_vendeur with its methode', () => {
  const cases: Array<[string, string]> = [
    ['ListingCallInitiated', 'appel'],
    ['ListingWhatsAppInitiated', 'whatsapp'],
    ['ListingMessageInitiated', 'message'],
    ['ListingCallbackRequested', 'rappel'],
  ];
  for (const [name, methode] of cases) {
    const ev = toGa4Event(name, { listingId: 12, brand: 'SYM', model: 'Jet 14' });
    assert.deepEqual(ev, { name: 'contact_vendeur', params: { methode, listing_id: '12', marque: 'SYM', modele: 'Jet 14' } }, name);
  }
});

test('personal data is never forwarded to Google Analytics', () => {
  const ev = toGa4Event('ListingCallInitiated', {
    listingId: 'a1', seller: 'Ali Ben Salah', phone: '+21622000000', userId: 'u-9', sellerType: 'particulier',
  });
  assert.deepEqual(ev, { name: 'contact_vendeur', params: { methode: 'appel', listing_id: 'a1' } });
});

test('phone reveal, deposit and share have their own events', () => {
  assert.deepEqual(toGa4Event('ListingPhoneRevealed', { listingId: 3 }), { name: 'afficher_numero', params: { listing_id: '3' } });
  assert.deepEqual(toGa4Event('ListingPublished', { category: 'Scooter' }), { name: 'annonce_publiee', params: { categorie: 'Scooter' } });
  assert.deepEqual(toGa4Event('ContentShared', { method: 'whatsapp', kind: 'listing', id: 4 }), { name: 'share', params: { method: 'whatsapp', content_type: 'listing' } });
});

test('account events stay out of Google Analytics', () => {
  assert.equal(toGa4Event('UserLogoutInitiated', { userId: 'u' }), null);
  assert.equal(toGa4Event('UserAccountDeletionInitiated', { userId: 'u' }), null);
});

test('monitoring forwards to GA4 and the deposit reports ListingPublished', () => {
  const mon = readFileSync(new URL('./monitoring.ts', import.meta.url), 'utf8');
  assert.match(mon, /const ga = toGa4Event\(name, properties\);\n\s*if \(ga\) trackGa4Event\(ga\.name, ga\.params\);/);
  const dep = readFileSync(new URL('../components/DepositAd.tsx', import.meta.url), 'utf8');
  assert.match(dep, /monitoring\.trackEvent\('ListingPublished'/);
});

// Owner, 2026-11-21: the fiches techniques (new models) have their own leads.
test('fiche contacts, quote and compare reach GA4 with the fiche id', () => {
  const fiche = { specId: 'abc', brand: 'SYM', model: 'Jet 14 125 AC E5' };
  assert.deepEqual(toGa4Event('SpecImporterCallInitiated', fiche), { name: 'contact_importateur', params: { methode: 'appel', fiche_id: 'abc', marque: 'SYM', modele: 'Jet 14 125 AC E5' } });
  assert.deepEqual(toGa4Event('SpecImporterWhatsAppInitiated', fiche), { name: 'contact_importateur', params: { methode: 'whatsapp', fiche_id: 'abc', marque: 'SYM', modele: 'Jet 14 125 AC E5' } });
  assert.deepEqual(toGa4Event('SpecQuoteRequested', fiche), { name: 'demande_devis', params: { fiche_id: 'abc', marque: 'SYM', modele: 'Jet 14 125 AC E5' } });
  assert.deepEqual(toGa4Event('SpecCompareAdded', fiche), { name: 'comparer_modeles', params: { fiche_id: 'abc', marque: 'SYM', modele: 'Jet 14 125 AC E5' } });
});

test('the quote form never sends the visitor details to GA4', () => {
  const ev = toGa4Event('SpecQuoteRequested', { specId: 7, first_name: 'Sami', phone: '+21655000000', email: 'a@b.tn' });
  assert.deepEqual(ev, { name: 'demande_devis', params: { fiche_id: '7' } });
});

test('every fiche lead path calls monitoring', () => {
  const api = readFileSync(new URL('../services/techSpecLeadsApi.ts', import.meta.url), 'utf8');
  assert.match(api, /monitoring\.trackEvent\(SPEC_LEAD_EVENT\[kind\]/);
  const sheet = readFileSync(new URL('../components/tech-specs/QuoteRequestSheet.tsx', import.meta.url), 'utf8');
  assert.match(sheet, /monitoring\.trackEvent\('SpecQuoteRequested', \{ specId, brand, model \}\)/);
  const page = readFileSync(new URL('../components/TechSpecsDetails.tsx', import.meta.url), 'utf8');
  assert.equal((page.match(/trackLead\(spec\.id, '(call|whatsapp|compare)', spec\)/g) || []).length, 5);
  assert.doesNotMatch(page, /trackLead\(spec\.id, '(call|whatsapp|compare)'\)/);
});
