import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../components/TechSpecsDetails.tsx', import.meta.url), 'utf8');
const gallery = readFileSync(new URL('../components/listing/ListingGallery.tsx', import.meta.url), 'utf8');

test('fiche, phones: no breadcrumb row; it stays in the page for crawlers and from 768 px', () => {
  assert.match(page, /Header: "hidden md:flex items-center justify-between mb-3 md:mb-6"/);
  assert.match(page, /<header className=\{S\.Header\}>[\s\S]*?<PageBreadcrumb/);
  assert.match(page, /\{ label: spec\.brand, href: brandHref, onClick: handleBack \}/);
});

test('fiche, phones: « ← » on the photo, top left, a real link to the brand page', () => {
  assert.match(page, /backLink=\{\{ href: brandHref, label: spec\.brand, onClick: handleBack \}\}/);
  assert.match(gallery, /backLink\?: \{ href: string; label: string; onClick\?: \(\) => void \};/);
  assert.match(gallery, /<a\s+href=\{backLink\.href\}\s+aria-label=\{`Retour à \$\{backLink\.label\}`\}\s+className=\{`\$\{S\.OverlayActionBtn\} md:hidden /);
  assert.match(gallery, /e\.stopPropagation\(\); \/\/ not the photo viewer/);
  assert.match(gallery, /<ArrowLeft size=\{20\}/);
});

test('fiche, phones: the brand above the title is the link up (44 px to the finger)', () => {
  assert.match(page, /<a\s+href=\{brandHref\}[\s\S]*?className="inline-flex items-center gap-0\.5 -my-3 py-3 font-sans text-\[14px\] font-bold text-primary-600/);
  assert.match(page, /\{spec\.brand\}\s*<ChevronRight size=\{15\}/);
});
