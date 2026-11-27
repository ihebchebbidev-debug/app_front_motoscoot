import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// « Particulier » sign-up = name, e-mail, password. Phone and governorate
// are asked with the first ad (StepPublish), which saves the phone on the
// account; the server no longer requires a phone for a « Particulier ».
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const modal = read('components/auth/LoginModal.tsx');
const api = read('services/authApi.ts');
const serverPhone = read('BackendNodeJs/src/utils/phone.js');

test('the « Particulier » screen shows one name field, no phone, no governorate', () => {
  const block = modal.slice(modal.indexOf("{userType === 'individual' ? ("), modal.indexOf(') : (', modal.indexOf("{userType === 'individual' ? (")));
  assert.match(block, /label="Votre nom"[\s\S]*autoComplete="name"[\s\S]*\{\.\.\.field\('fullName'\)\}/);
  assert.doesNotMatch(block, /phoneField|field\('governorate'\)|field\('firstName'\)/);
});

test('the sign-up sends the name as full_name and no phone or governorate', () => {
  assert.match(modal, /full_name: v\.fullName\.trim\(\),\s*account_type: 'individual',/);
  assert.match(api, /full_name: p\.full_name,\s*phone: p\.phone \|\| undefined,\s*seller_type: 'Particulier',/);
});

test('the deposit still asks for the phone and saves it on the account', () => {
  assert.match(read('utils/depositRules.ts'), /field: 'phone'/);
  assert.match(read('services/listingService.ts'), /authApi\.updateProfile\(\{ phone: normalizedPhone \}\)/);
});

test('the server: phone optional for « Particulier », required for « Pro »', () => {
  assert.match(serverPhone, /return sellerType === 'Pro' \? \{ error: PRO_PHONE_REQUIRED \} : \{ phone: null \};/);
});
