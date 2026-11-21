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
  assert.match(page, /onClick=\{\(\) => trackLead\(spec\.id, 'call', spec\)\}/);
  assert.match(page, /onClick=\{\(\) => trackLead\(spec\.id, 'whatsapp', spec\)\}/);
  assert.match(page, /trackLead\(spec\.id, 'compare', spec\);/);
  assert.match(page, /className=\{`\$\{S\.FloatRound\} \$\{S\.FloatWhatsapp\}`\}/);
  assert.match(page, /FloatWhatsapp: "bg-\[#25D366\]/);
  assert.match(page, /<FileText size=\{18\}/);
  assert.match(page, /<QuoteRequestSheet[\s\S]*?returnFocus=\{quoteButtonRef\}/);
});

test('quote sheet: the model card photo (as on the brand page), no price, the importer small', () => {
  const sheet = readFileSync(new URL('../components/tech-specs/QuoteRequestSheet.tsx', import.meta.url), 'utf8');
  assert.match(page, /cardImage=\{spec\.image\}/);
  // Bigger photo (112 px, 128 from 360 px), brand and model in bold.
  assert.match(sheet, /className="w-28 min-\[360px\]:w-32 aspect-\[4\/3\] rounded-\[14px\] object-cover/);
  assert.match(sheet, /font-bold text-gray-600 tracking-\[0\.01em\]">\{brand\}<\/p>/);
  assert.match(sheet, /text-\[17px\] leading-\[1\.2\] font-bold text-gray-900 tracking-\[-0\.01em\] line-clamp-2">\{model\}<\/p>/);
  assert.doesNotMatch(sheet, /priceText/);
  assert.match(sheet, /text-\[12px\] leading-4 text-gray-600">Importateur : \{importerName\}/);
});

test('desktop card (owner): price + Comparer, WhatsApp, Appeler as grey icons (green / orange on hover); Devis #E65400 below', () => {
  assert.doesNotMatch(page, />\s*Comparer ce modèle\s*</); // the old big orange compare button
  assert.match(page, /CardIcon: "shrink-0 w-11 h-11 [^"]*rounded-xl bg-gray-50 text-gray-600 [^"]*hover:bg-gray-100 /); // lighter grey (owner)
  assert.match(page, /CardIconWhatsapp: "hover:!text-\[#1DA851\] /);
  assert.match(page, /CardIconCall: "hover:!text-primary-600 /);
  assert.match(page, /onClick=\{handleCompare\} className=\{S\.CardIcon\} aria-label="Comparer ce modèle" title="Comparer">/);
  assert.match(page, /className=\{`\$\{S\.CardIcon\} \$\{S\.CardIconWhatsapp\}`\}/);
  assert.match(page, /className=\{`\$\{S\.CardIcon\} \$\{S\.CardIconCall\}`\}/);
  assert.match(page, /CardQuote: "w-full h-14 [^"]*rounded-2xl bg-primary-600 text-white /); // #E65400
  assert.match(page, /<FileText size=\{20\} strokeWidth=\{2\} aria-hidden="true" \/>\s*Demander un devis\s*<\/button>/);
  assert.match(page, /const openQuote = \(e: React\.MouseEvent<HTMLElement>\) => \{ quoteButtonRef\.current = e\.currentTarget; setQuoteOpen\(true\); \};/);
  // No subscription: Comparer alone, the big orange button with its word.
  assert.match(page, /<button type="button" onClick=\{handleCompare\} className=\{S\.CardQuote\}>\s*<Scale size=\{20\}[^>]*\/>\s*Comparer\s*<\/button>/);
});
