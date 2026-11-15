import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 2026-11-15, owner: « dans fiche technique version smartphone uniquement,
// ne pas afficher le breadcrumb ». Hub /fiches-techniques and brand pages hide
// the row under 768 px; the model page already did. From 768 px the trail
// stays, and the BreadcrumbList JSON-LD is untouched.

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('fiches techniques: no breadcrumb row on phones, trail kept from 768 px', () => {
  const hero = read('../components/tech-specs/TechSpecsHero.tsx');
  assert.match(hero, /breadcrumbOnMobile = true,/);
  assert.match(hero, /breadcrumbOnMobile \? '' : 'hidden md:flex '/);
  for (const p of ['../components/TechSpecsBrands.tsx', '../components/TechSpecsModels.tsx']) {
    const src = read(p);
    assert.match(src, /breadcrumbOnMobile=\{false\}/, p);
    assert.match(src, /"@type": "BreadcrumbList"/, p);
  }
  // Other hero pages (news, tips, comparator, 125 prices) keep theirs.
  for (const p of ['../components/News.tsx', '../components/Tips.tsx', '../components/Comparator.tsx', '../components/Scooter125Prices.tsx'])
    assert.doesNotMatch(read(p), /breadcrumbOnMobile/, p);
});
