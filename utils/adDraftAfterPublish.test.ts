import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 2026-11-12, owner: « quand je poste une annonce il y a une mémoire
// d'annonce ». The rules now live in the deposit session and are tested
// through its interface (utils/depositSession.test.ts); here, that the page
// calls them at the right moments.
const page = readFileSync(new URL('../components/DepositAd.tsx', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../hooks/useDepositSession.ts', import.meta.url), 'utf8');

test('after a publish, the session is told: draft removed, nothing saved', () => {
  assert.match(page, /\/\/ The draft is done: removed, and nothing is saved until a new deposit\.\s*markPublished\(\);/);
  assert.match(hook, /const markPublished = useCallback\(\(\) => session\.published\(\), \[session\]\);/);
  assert.doesNotMatch(page, /suppressSavesRef|stoppedRef|clearDraft|resumeDraft/);
});

test('« Déposer une autre annonce » and « Réinitialiser » start a new deposit through the session', () => {
  assert.match(page, /const startBlankDeposit = \(\) => \{\s*startNew\(\);\s*setPublished\(null\);/);
  assert.match(hook, /session\.startNew\(\);\s*market\.clear\(\);\s*setRun\(\(n\) => n \+ 1\);/);
});

test('« Réinitialiser »: confirms, then starts a blank deposit (form, photos, draft)', () => {
  assert.match(page, /const handleResetDeposit = \(\) => \{\s*if \(!window\.confirm\('Effacer toutes les informations de cette annonce et recommencer \?'\)\) return;\s*startBlankDeposit\(\);/);
  assert.match(page, /onClick=\{handleResetDeposit\}[\s\S]{0,800}?Réinitialiser/);
  assert.match(page, /min-h-11/); // 44 px to the finger
});
