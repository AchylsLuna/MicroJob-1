import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isExpiredPaymentMethod,
  normalizePaymentMethodMetadata,
} from '../../lib/paymentMethodValidation.js';

const now = new Date('2026-07-15T00:00:00.000Z');

test('normalizes safe masked payment method metadata', () => {
  const result = normalizePaymentMethodMetadata(
    {
      cardholderName: '  Ana   Santos ',
      brand: 'Visa',
      last4: '4242',
      expiryMonth: 8,
      expiryYear: 2028,
    },
    now
  );

  assert.deepEqual(result.value, {
    cardholderName: 'Ana Santos',
    brand: 'Visa',
    last4: '4242',
    expiryMonth: 8,
    expiryYear: 2028,
  });
});

test('rejects full card numbers and security codes', () => {
  const result = normalizePaymentMethodMetadata(
    {
      cardholderName: 'Ana Santos',
      brand: 'Visa',
      last4: '4242',
      expiryMonth: 8,
      expiryYear: 2028,
      cvv: '123',
    },
    now
  );

  assert.match(result.error, /must not be sent/i);
});

test('rejects expired payment methods', () => {
  const result = normalizePaymentMethodMetadata(
    {
      cardholderName: 'Ana Santos',
      brand: 'Visa',
      last4: '4242',
      expiryMonth: 6,
      expiryYear: 2026,
    },
    now
  );

  assert.equal(result.error, 'This card has expired.');
  assert.equal(isExpiredPaymentMethod(6, 2026, now), true);
  assert.equal(isExpiredPaymentMethod(7, 2026, now), false);
});
