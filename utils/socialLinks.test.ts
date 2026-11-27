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

test('login window: real logos in their colours, 44 px, named, new tab', () => {
  assert.match(modal, /aria-label=\{`\$\{label\} \(nouvel onglet\)`\}/);
  assert.match(modal, /target="_blank"\s+rel="noopener noreferrer"/);
  assert.match(modal, /'w-11 h-11 rounded-full/);
  assert.match(modal, /<BrandSocialIcon network=\{key\}/);
  const brand = read('components/ui/BrandSocialIcon.tsx');
  assert.match(brand, /fill=\{`#\$\{siFacebook\.hex\}`\}/);
  assert.match(brand, /radialGradient/);
  assert.match(brand, /#25F4EE[\s\S]*#FE2C55/);
});

test('social links: bottom of the picture on tablet / desktop, none on phones', () => {
  assert.match(modal, /<LoginSocialLinks onPhoto \/>/);
  assert.doesNotMatch(modal, /<LoginSocialLinks inline/);
});

test('« Pas encore de compte ? S\'inscrire » is offered on every screen size', () => {
  assert.doesNotMatch(modal, /!isSignUp && 'max-md:hidden'/);
  assert.match(modal, /'Pas encore de compte \?'/);
  // 44 px touch target on phones, 24 px with a mouse (WCAG 2.5.8).
  assert.match(modal, /className="min-h-\[44px\] md:min-h-\[24px\] inline-flex/);
  // Narrow phones: « S'inscrire » on one line; « gratuitement » from 420 px.
  assert.match(modal, /<span className="hidden min-\[420px\]:inline">&nbsp;gratuitement<\/span>/);
});
