import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hook = readFileSync(new URL('../hooks/useAdDraft.ts', import.meta.url), 'utf8');
const page = readFileSync(new URL('../components/DepositAd.tsx', import.meta.url), 'utf8');

// 2026-11-12, owner: « quand je poste une annonce il y a une mémoire
// d'annonce ». After a publish, autosave skipped only 3 passes; watch() gives a
// new object every render, so the success screen's re-renders saved the
// published listing again and it came back as a draft on the next deposit.
test('after a publish, the draft is removed and autosave stays off', () => {
  assert.match(hook, /const clearDraft = \(\) => \{\s*stoppedRef\.current = true;\s*try \{\s*localStorage\.removeItem\(storageKey\);/);
  assert.match(hook, /if \(isFirstRender\.current\) return;\s*if \(stoppedRef\.current\) return;/);
  assert.doesNotMatch(hook, /suppressSavesRef/); // no more « skip the next N renders »
  assert.match(page, /\/\/ The draft is done: remove it so it does not come back on the next deposit\.\s*clearDraft\(\);/);
});

test('« Déposer une autre annonce » starts a fresh draft that is saved again', () => {
  assert.match(hook, /const resumeDraft = \(\) => \{\s*stoppedRef\.current = false;\s*\};/);
  assert.match(page, /const startBlankDeposit = \(\) => \{\s*clearDraft\(\);\s*reset\(\);\s*setMediaList\(\[\]\);\s*setStep\(1\);\s*setPublished\(null\);[\s\S]*?resumeDraft\(\);\s*\};/);
});

test('« Réinitialiser »: confirms, then starts a blank deposit (form, photos, draft)', () => {
  assert.match(page, /const handleResetDeposit = \(\) => \{\s*if \(!window\.confirm\('Effacer toutes les informations de cette annonce et recommencer \?'\)\) return;\s*startBlankDeposit\(\);/);
  assert.match(page, /onClick=\{handleResetDeposit\}[\s\S]{0,800}?Réinitialiser/);
  assert.match(page, /min-h-11/); // 44 px to the finger
});
