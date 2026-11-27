import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The site's social accounts (Facebook, Instagram, TikTok…) come from the
// backoffice and are shown with one shared hook: the footer and the bottom
// of the login window use the same links and icons.
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const hook = read('hooks/useSocialLinks.ts');
const footer = read('components/Footer.tsx');
const modal = read('components/auth/LoginModal.tsx');

test('one shared source for the social links', () => {
  assert.match(hook, /queryKey: \['site-settings', 'social-links'\]/);
  assert.match(hook, /tiktok: TikTokIcon/);
  assert.match(footer, /useSocialLinks\(\)/);
  assert.match(modal, /useSocialLinks\(\)/);
  assert.doesNotMatch(footer, /Music2/, 'TikTok is the TikTok glyph, not a music note');
});

test('login window: 44 px links, named, opened in a new tab', () => {
  assert.match(modal, /aria-label=\{`\$\{label\} \(nouvel onglet\)`\}/);
  assert.match(modal, /target="_blank"\s+rel="noopener noreferrer"/);
  assert.match(modal, /className="w-11 h-11 rounded-full/);
  assert.match(modal, /Suivez-nous/);
});
