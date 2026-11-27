import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailProblem, emptyLoginForm, loginFormModeOf, loginFormSchemas, PASSWORD_MIN } from './loginFormSchema';
import { TUNISIA_PHONE_ERROR } from './phoneUtils';

const errorsOf = (mode: keyof typeof loginFormSchemas, values: Record<string, string>) => {
  const result = loginFormSchemas[mode].safeParse({ ...emptyLoginForm, ...values });
  if (result.success) return {};
  // First problem per field, as the form shows it.
  const out: Record<string, string> = {};
  for (const i of result.error.issues) out[String(i.path[0])] ??= i.message;
  return out;
};

// « Particulier »: name, e-mail, password — nothing else.
const individual = { fullName: 'Sami Ben Ali', email: 'sami@gmail.com', password: 'secret1' };
// « Professionnel »: shop, name, phone, e-mail, password.
const pro = { shopName: 'Tunis Moto', fullName: 'Sami Ben Ali', phone: '22123456', email: 'sami@gmail.com', password: 'secret1' };

test('which rules apply follows the screen', () => {
  assert.equal(loginFormModeOf(false, 'pro'), 'login');
  assert.equal(loginFormModeOf(true, 'individual'), 'individual');
  assert.equal(loginFormModeOf(true, 'pro'), 'pro');
});

test('sign in asks only for an e-mail and a password, in French', () => {
  assert.deepEqual(errorsOf('login', {}), {
    email: 'Saisissez votre adresse e-mail.',
    password: 'Saisissez votre mot de passe.',
  });
  assert.deepEqual(errorsOf('login', { email: 'sami@gmail.com', password: 'x' }), {});
});

test('a « Particulier » sign-up asks only for a name, an e-mail and a password', () => {
  assert.deepEqual(errorsOf('individual', individual), {});
  const empty = errorsOf('individual', {});
  assert.deepEqual(Object.keys(empty).sort(), ['email', 'fullName', 'password']);
  assert.equal(empty.fullName, 'Saisissez votre nom.');
  // Phone and governorate are not asked here (they come with the first ad).
  assert.deepEqual(errorsOf('individual', { ...individual, phone: '', governorate: '' }), {});
});

test('the new password must be long enough', () => {
  assert.equal(errorsOf('individual', { ...individual, password: 'abc' }).password, `Au moins ${PASSWORD_MIN} caractères.`);
});

test('a « Pro » phone is required and must be Tunisian', () => {
  assert.equal(errorsOf('pro', { ...pro, phone: '' }).phone, 'Saisissez votre numéro de téléphone.');
  assert.equal(errorsOf('pro', { ...pro, phone: '12' }).phone, TUNISIA_PHONE_ERROR);
  assert.deepEqual(errorsOf('pro', { ...pro, phone: '+216 22 123 456' }), {});
});

test('a « Pro » sign-up asks for 5 fields; no address, governorate or logo', () => {
  assert.deepEqual(errorsOf('pro', pro), {});
  assert.deepEqual(Object.keys(errorsOf('pro', {})).sort(), ['email', 'fullName', 'password', 'phone', 'shopName']);
  assert.equal(errorsOf('pro', { ...pro, shopName: '' }).shopName, 'Saisissez le nom de la boutique.');
});

test('blank spaces do not count as a value', () => {
  assert.equal(errorsOf('individual', { ...individual, fullName: '   ' }).fullName, 'Saisissez votre nom.');
  assert.equal(errorsOf('pro', { ...pro, shopName: '   ' }).shopName, 'Saisissez le nom de la boutique.');
});

test('« Mot de passe oublié » checks the e-mail the same way', () => {
  assert.equal(emailProblem(''), 'Saisissez votre adresse e-mail.');
  assert.match(emailProblem('sami@') ?? '', /Adresse e-mail invalide/);
  assert.equal(emailProblem(' sami@gmail.com '), null);
});
