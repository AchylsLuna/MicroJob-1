import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PHONE_DIGITS,
  isValidEmail,
  isValidName,
  isValidPhone,
  normalizeEmail,
  normalizeName,
  normalizePhone,
} from '../../lib/authValidation.js';

test('normalizeEmail trims and lowercases input', () => {
  assert.equal(normalizeEmail('  USER@Example.COM '), 'user@example.com');
});

test('email validator accepts valid email and rejects invalid one', () => {
  assert.equal(isValidEmail('person@example.com'), true);
  assert.equal(isValidEmail('person@@example'), false);
});

test('normalizePhone strips non-digit characters', () => {
  assert.equal(normalizePhone('+1 (234) 567-8901'), '12345678901');
});

test('phone validator enforces exact configured digit length', () => {
  assert.equal(isValidPhone('12345678901'), true);
  assert.equal(isValidPhone('1234567890'), false);
  assert.equal('12345678901'.length, PHONE_DIGITS);
});

test('normalizeName collapses duplicate spaces and trims', () => {
  assert.equal(normalizeName('  Ana   Maria  '), 'Ana Maria');
});

test('name validator accepts letters/punctuation and rejects digits', () => {
  assert.equal(isValidName("Jean-Luc O'Neil"), true);
  assert.equal(isValidName('John Doe 2'), false);
});
