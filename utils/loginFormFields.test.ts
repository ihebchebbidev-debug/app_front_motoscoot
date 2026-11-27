import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The login window's fields are one react-hook-form form checked by the
// rules in utils/loginFormSchema.ts: each field is checked when left, its
// French error shows under it and is read with it by screen readers.
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const modal = read('components/auth/LoginModal.tsx');

test('one form, checked when a field is left, with the shared rules for the current screen', () => {
  assert.match(modal, /useForm<LoginFormValues>\(\{\s*mode: 'onTouched'/);
  assert.match(modal, /zodResolver\(loginFormSchemas\[formModeRef\.current\]\)/);
  assert.match(modal, /<form onSubmit=\{handleSubmit\} noValidate/);
  assert.doesNotMatch(modal, /const \[(email|password|firstName|phone|shopName)\b/, 'no per-field useState left');
});

test('every text field and select is registered and shows its own error', () => {
  for (const key of ['email', 'password', 'fullName', 'firstName', 'lastName', 'governorate', 'shopName', 'shopAddress']) {
    assert.match(modal, new RegExp(`\\{\\.\\.\\.field\\('${key}'\\)\\}[\\s\\S]{0,400}error=\\{fieldErrors\\.${key}\\?\\.message\\}`), key);
  }
  assert.match(modal, /\{\.\.\.phoneField\}[\s\S]{0,500}error=\{fieldErrors\.phone\?\.message\}/);
});

test('field errors are read with their field (shared Input and Select)', () => {
  for (const file of ['components/ui/Input.tsx', 'components/ui/Select.tsx']) {
    const src = read(file);
    assert.match(src, /aria-invalid=\{error \? true/, file);
    assert.match(src, /aria-describedby=\{error \? errorId/, file);
    assert.match(src, /<p id=\{errorId\}/, file);
  }
});

test('after a failed submit, the first field in error on screen gets the focus', () => {
  assert.match(modal, /shouldFocusError: false/);
  assert.match(modal, /form\.handleSubmit\(submitValid, focusFirstInvalid\)/);
  assert.match(modal, /contentRef\.current\?\.querySelector<HTMLElement>\('\[aria-invalid="true"\]'\)/);
});
