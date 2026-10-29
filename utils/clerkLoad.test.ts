import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsClerkNow } from './clerkLoad';

test('sign-in tool is not loaded for an ordinary visit', () => {
  assert.equal(needsClerkNow({ loginOpen: false, pathname: '/', cookie: '' }), false);
  assert.equal(needsClerkNow({ loginOpen: false, pathname: '/annonces', cookie: '__client_uat=0' }), false);
});
test('sign-in tool loads when the login window opens', () => {
  assert.equal(needsClerkNow({ loginOpen: true, pathname: '/', cookie: '' }), true);
});
test('sign-in tool loads on the Google return page', () => {
  assert.equal(needsClerkNow({ loginOpen: false, pathname: '/sso-callback', cookie: '' }), true);
});
test('sign-in tool loads when a Google session already exists', () => {
  assert.equal(needsClerkNow({ loginOpen: false, pathname: '/', cookie: 'a=1; __client_uat_Ab12=1792739000' }), true);
});
