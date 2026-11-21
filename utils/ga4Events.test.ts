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
