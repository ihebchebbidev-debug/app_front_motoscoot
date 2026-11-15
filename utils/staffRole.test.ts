import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { staffRoleOf } from './staffRole';

// The API sends every user_roles row as `roles`; the back-office link in the
// header and the account menu read the derived `staffRole`.
test('a moderator is recognised from the roles list', () => {
  assert.equal(staffRoleOf(['user', 'moderator']), 'moderator');
  const authApi = readFileSync(new URL('../services/authApi.ts', import.meta.url), 'utf8');
  assert.match(authApi, /staffRole: staffRoleOf\(u\.roles\)/);
});

test('admin wins over moderator', () => {
  assert.equal(staffRoleOf(['moderator', 'admin']), 'admin');
});

test('ordinary and pro accounts get no back-office link', () => {
  assert.equal(staffRoleOf(['user']), undefined);
  assert.equal(staffRoleOf(['pro']), undefined);
  assert.equal(staffRoleOf(undefined), undefined);
});

test('the console still works for admins while the API has no /admin/access yet', () => {
  const src = readFileSync(new URL('../components/admin/SuperAdminDashboard.tsx', import.meta.url), 'utf8');
  assert.match(src, /const accessMissing = \(accessError as any\)\?\.status === 404;/);
  assert.match(src, /const isAdminRole = access\?\.role === 'admin' \|\| accessMissing;/);
});

test('moderators see only actualités, conseils and fiches techniques, without delete', () => {
  const src = readFileSync(new URL('../components/admin/SuperAdminDashboard.tsx', import.meta.url), 'utf8');
  assert.match(src, /const MODERATOR_TABS: TabKey\[\] = \['articles', 'tips', 'tech-specs'\];/);
  for (const tab of ['ArticlesTab', 'TipsTab', 'TechSpecsTab']) {
    assert.match(src, new RegExp(`<${tab} canDelete=\\{canDelete\\} />`), tab);
    const tabSrc = readFileSync(new URL(`../components/admin/${tab}.tsx`, import.meta.url), 'utf8');
    assert.match(tabSrc, /\{canDelete && <button onClick=\{\(\) => del\(/, `${tab} hides delete`);
  }
});

test('the Users page can assign and remove the moderator role', () => {
  const src = readFileSync(new URL('../components/admin/UsersTab.tsx', import.meta.url), 'utf8');
  assert.match(src, /onClick=\{\(\) => promote\(u\.id, 'moderator'\)\}/);
  assert.match(src, /onClick=\{\(\) => demote\(u\.id, 'moderator'\)\}/);
});
