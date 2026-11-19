import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { whatsappHref, validateQuoteForm } from './ficheLeads';

const page = readFileSync(new URL('../components/TechSpecsDetails.tsx', import.meta.url), 'utf8');

test('WhatsApp link: digits only, +216 added to a Tunisian 8-digit number, message naming the model', () => {
  const href = whatsappHref('22 123 456', 'SYM Jet 14', 'https://www.moto-scoot.tn/fiche-technique/sym-jet-14')!;
  assert.match(href, /^https:\/\/wa\.me\/21622123456\?text=/);
  assert.equal(decodeURIComponent(href.split('text=')[1]), 'Bonjour, je suis intéressé(e) par le SYM Jet 14 vu sur Moto-Scoot.tn : https://www.moto-scoot.tn/fiche-technique/sym-jet-14');
  assert.match(whatsappHref('+216 98 765 432', 'X', 'u')!, /wa\.me\/21698765432\?/);
  assert.match(whatsappHref('0033 6 12 34 56 78', 'X', 'u')!, /wa\.me\/33612345678\?/);
  assert.equal(whatsappHref('', 'X', 'u'), null);
});

test('quote form: same rules as the server, messages that say how to fix', () => {
  const ok = { firstName: 'Ali', lastName: 'Ben', phone: '22 123 456', email: 'ali@gmail.com', consent: true };
  assert.deepEqual(validateQuoteForm(ok), {});
  const bad = validateQuoteForm({ firstName: ' ', lastName: '', phone: '12', email: 'ali@', consent: false });
  assert.deepEqual(Object.keys(bad).sort(), ['consent', 'email', 'firstName', 'lastName', 'phone']);
  assert.match(bad.phone!, /22 123 456/);
});

test('floating bar: Appel, WhatsApp and Devis only for a subscribed importer; every tap counted', () => {
  assert.match(page, /const subscribed = spec\.importer\?\.subscribed === true;/);
  assert.match(page, /onClick=\{\(\) => trackLead\(spec\.id, 'call'\)\}/);
  assert.match(page, /onClick=\{\(\) => trackLead\(spec\.id, 'whatsapp'\)\}/);
  assert.match(page, /trackLead\(spec\.id, 'compare'\);/);
  assert.match(page, /className=\{`\$\{S\.FloatRound\} \$\{S\.FloatWhatsapp\}`\}/);
  assert.match(page, /FloatWhatsapp: "bg-\[#25D366\]/);
  assert.match(page, /<FileText size=\{20\}/);
  assert.match(page, /<QuoteRequestSheet[\s\S]*?returnFocus=\{quoteButtonRef\}/);
});

test('quote sheet: the model card photo (as on the brand page), no price, the importer small', () => {
  const sheet = readFileSync(new URL('../components/tech-specs/QuoteRequestSheet.tsx', import.meta.url), 'utf8');
  assert.match(page, /cardImage=\{spec\.image\}/);
  assert.match(sheet, /className="w-20 aspect-\[4\/3\] rounded-xl object-cover bg-white shrink-0"/);
  assert.doesNotMatch(sheet, /priceText/);
  assert.match(sheet, /text-\[12px\] leading-4 text-gray-600">Importateur : \{importerName\}/);
});
