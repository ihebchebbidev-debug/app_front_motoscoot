import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// « Professionnel » sign-up = shop name, name, phone, e-mail, password.
// Address, governorate and logo are set afterwards in Réglages (SettingsTab
// already edits them); the server no longer requires the address at sign-up.
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const modal = read('components/auth/LoginModal.tsx');
const controller = read('BackendNodeJs/src/controllers/authController.js');

test('the Pro screen: shop, name, phone; no address, governorate or logo', () => {
  const start = modal.indexOf('« Professionnel »: what a shop needs to start.');
  const block = modal.slice(start, modal.indexOf('<div className="space-y-4 pt-2">', start));
  assert.match(block, /\{\.\.\.field\('shopName'\)\}/);
  assert.match(block, /\{\.\.\.field\('fullName'\)\}/);
  assert.match(block, /\{\.\.\.phoneField\}/);
  assert.doesNotMatch(block, /shopAddress|governorate'|type="file"|Logo \(JPG/);
  assert.match(block, /à compléter ensuite dans Réglages/);
});

test('the sign-up sends the shop name, the name and the phone only', () => {
  assert.match(modal, /shop_name: v\.shopName\.trim\(\),\s*full_name: v\.fullName\.trim\(\),[\s\S]{0,120}phone: formatTunisiaPhone\(v\.phone\),\s*account_type: 'pro',/);
  assert.doesNotMatch(modal, /uploadsApi|compressImage|logoFile/);
});

test('Réglages still lets a Pro set address, logo and governorate', () => {
  const settings = read('components/dashboard/SettingsTab.tsx');
  for (const key of ['shopAddress', 'shopLogo', 'governorate']) assert.match(settings, new RegExp(key));
});

test('the server needs the shop name, not the address, at Pro sign-up', () => {
  assert.match(controller, /if \(seller_type === 'Pro' && !shop_name\)/);
  assert.doesNotMatch(controller, /L'adresse de la boutique est requise/);
});
