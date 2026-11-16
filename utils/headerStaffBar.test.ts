import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Owner rule (16 Nov 2026): an admin or moderator signed in on the public
// site sees ONLY the orange "Interface administrateur" bar at the top; the
// header links, icons, account menu and "Déposer une annonce" stay normal.
const src = readFileSync(new URL('../components/layout/Header.tsx', import.meta.url), 'utf8');

test('the role only drives the orange bar', () => {
  const uses = src.match(/\bisStaffUser\b/g) || [];
  assert.equal(uses.length, 2, 'declared once, used once (showAdminBar)');
  assert.match(src, /const showAdminBar = isStaffUser && currentView !== 'admin';/);
});

test('no admin-only variant of the header is left', () => {
  for (const s of ['isAdminUser', 'adminLabel', 'Console admin', 'Mode admin', 'label="Administration"']) {
    assert.ok(!src.includes(s), s);
  }
});
