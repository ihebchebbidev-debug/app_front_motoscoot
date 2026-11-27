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

const individual = {
  firstName: 'Sami', lastName: 'Ben Ali', governorate: 'Tunis', phone: '22123456',
  email: 'sami@gmail.com', password: 'secret1',
};

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

test('a complete « Particulier » sign-up passes; each missing field is named', () => {
  assert.deepEqual(errorsOf('individual', individual), {});
  const empty = errorsOf('individual', {});
  assert.deepEqual(Object.keys(empty).sort(), ['email', 'firstName', 'governorate', 'lastName', 'password', 'phone']);
  assert.equal(empty.governorate, 'Choisissez votre gouvernorat.');
});

test('the phone must be Tunisian and the new password long enough', () => {
  assert.equal(errorsOf('individual', { ...individual, phone: '12' }).phone, TUNISIA_PHONE_ERROR);
  assert.deepEqual(errorsOf('individual', { ...individual, phone: '+216 22 123 456' }), {});
  assert.equal(errorsOf('individual', { ...individual, password: 'abc' }).password, `Au moins ${PASSWORD_MIN} caractères.`);
});

test('« Professionnel » also needs the shop name and address', () => {
  const errors = errorsOf('pro', individual);
  assert.deepEqual(Object.keys(errors).sort(), ['shopAddress', 'shopName']);
  assert.deepEqual(errorsOf('pro', { ...individual, shopName: 'Tunis Moto', shopAddress: 'Rue de Marseille' }), {});
});

test('blank spaces do not count as a value', () => {
  assert.equal(errorsOf('individual', { ...individual, firstName: '   ' }).firstName, 'Saisissez votre prénom.');
});

test('« Mot de passe oublié » checks the e-mail the same way', () => {
  assert.equal(emailProblem(''), 'Saisissez votre adresse e-mail.');
  assert.match(emailProblem('sami@') ?? '', /Adresse e-mail invalide/);
  assert.equal(emailProblem(' sami@gmail.com '), null);
});
