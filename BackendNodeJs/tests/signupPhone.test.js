/**
 * Phone at sign-up (POST /auth/register), rule in src/utils/phone.js:
 *   - « Particulier »: optional (sellers give it with their first ad, which
 *     saves it on the account, as Google sign-ups already do);
 *   - « Pro »: required;
 *   - any number given must be a valid Tunisian number, stored formatted.
 *
 * Runner: node --test tests/signupPhone.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolveSignupPhone, PRO_PHONE_REQUIRED, TUNISIA_PHONE_ERROR } = require('../src/utils/phone');

test('a « Particulier » may sign up without a phone', () => {
  assert.deepEqual(resolveSignupPhone(undefined, 'Particulier'), { phone: null });
  assert.deepEqual(resolveSignupPhone('', 'Particulier'), { phone: null });
  assert.deepEqual(resolveSignupPhone('   ', 'Particulier'), { phone: null });
});

test('a « Pro » must give a phone', () => {
  assert.deepEqual(resolveSignupPhone(undefined, 'Pro'), { error: PRO_PHONE_REQUIRED });
  assert.deepEqual(resolveSignupPhone('', 'Pro'), { error: PRO_PHONE_REQUIRED });
});

test('a number that is given must be valid, and is stored formatted', () => {
  assert.deepEqual(resolveSignupPhone('12', 'Particulier'), { error: TUNISIA_PHONE_ERROR });
  assert.deepEqual(resolveSignupPhone('22123456', 'Pro'), { phone: '+216 22 123 456' });
  assert.deepEqual(resolveSignupPhone('22123456', 'Particulier'), { phone: '+216 22 123 456' });
});

test('the register handler uses this rule', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/controllers/authController.js'), 'utf8');
  assert.match(src, /const signupPhone = resolveSignupPhone\(rawPhone, seller_type\);/);
  assert.doesNotMatch(src, /if \(!rawPhone \|\| !isValidTunisiaPhone\(rawPhone\)\)/);
});
