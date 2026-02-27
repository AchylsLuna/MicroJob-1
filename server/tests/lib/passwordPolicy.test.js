import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  getPasswordChecks,
  isStrongPassword,
} from '../../lib/passwordPolicy.js';

test('getPasswordChecks marks expected rule violations', () => {
  const checks = getPasswordChecks('short');
  assert.deepEqual(checks, {
    minLength: false,
    uppercase: false,
    lowercase: true,
    number: false,
    special: false,
  });
});

test('isStrongPassword returns true for a compliant password', () => {
  assert.equal(isStrongPassword('StrongP@ss1'), true);
});

test('policy message includes configured minimum length', () => {
  assert.equal(PASSWORD_POLICY_MESSAGE.includes(String(MIN_PASSWORD_LENGTH)), true);
});
