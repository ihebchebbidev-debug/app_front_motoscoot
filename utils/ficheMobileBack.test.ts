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

test('listing, phones: same as the fiche — no breadcrumb row, « ← » on the photo back to the search', () => {
  const listing = readFileSync(new URL('../components/ListingDetails.tsx', import.meta.url), 'utf8');
  assert.match(listing, /Header: "hidden md:flex items-center justify-between mb-3 md:mb-6"/);
  assert.match(listing, /<header className=\{S\.Header\}>\s*<PageBreadcrumb/);
  assert.match(listing, /backLink=\{\{ href: '\/annonces', label: 'Annonces', onClick: goBack \}\}/);
});

test('article, phones: no breadcrumb row, the photo first with « ← » on it, then the one h1', () => {
  const article = readFileSync(new URL('../components/ArticleDetails.tsx', import.meta.url), 'utf8');
  assert.match(article, /<header className="order-2 md:order-1 /);
  assert.match(article, /\{\/\* Featured Image \*\/\}\s*<div className="order-1 md:order-2 /);
  assert.equal((article.match(/<h1 /g) || []).length, 2); // the page's title + « Article introuvable »
  assert.doesNotMatch(article, /Titre Mobile/);
  assert.match(article, /<a\s+href="\/actualites"[\s\S]{0,300}?onNavigate\?\.\('news'\);[\s\S]{0,200}?aria-label="Retour aux actualités"[\s\S]{0,80}?className="md:hidden absolute top-3 left-3 /);
});
