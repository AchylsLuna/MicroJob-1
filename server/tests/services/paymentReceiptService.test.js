import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPublicReceiptNumber,
  getReceiptSections,
  maskReceiptIdentifier,
} from '../../services/paymentReceiptService.js';

test('receipt identifiers are masked without exposing internal transaction data', () => {
  assert.equal(
    maskReceiptIdentifier('6aae75acb9ef713e37', { visibleStart: 8, visibleEnd: 6 }),
    '6aae75ac****713e37',
  );
  assert.equal(
    maskReceiptIdentifier('cs_2b096c10f42ac463d', { visibleStart: 11, visibleEnd: 5 }),
    'cs_2b096c10****c463d',
  );
});

test('a top-up receipt uses professional sections and a public receipt number', () => {
  const transaction = {
    _id: '6aae75acb9ef713e37c31abc',
    type: 'TOP_UP',
    status: 'COMPLETED',
    balanceTarget: 'EMPLOYER',
    amount: 2000,
    provider: 'paymongo',
    providerReference: 'cs_2b096c10f42ac463d',
    reference: 'TOPUP-6aae75acb9ef713e37c31abc-EMPLOYER-1780000000000',
    createdAt: new Date('2026-09-20T08:00:00.000Z'),
  };
  const sections = getReceiptSections(transaction, {
    _id: '6aae75acb9ef12713e37',
    firstName: 'Jonas',
    lastName: 'Enriquez',
  });
  const rendered = sections.flatMap((section) => section.rows).map(([label, value]) => `${label}: ${value}`).join('\n');

  assert.deepEqual(sections.map((section) => section.title), ['Transaction Details', 'Payment Reference']);
  assert.match(getPublicReceiptNumber(transaction), /^MJ-TOPUP-20260920-\d{6}$/);
  assert.match(rendered, /Account ID: 6aae75ac\*\*\*\*713e37/);
  assert.match(rendered, /Provider Reference: cs_2b096c10\*\*\*\*c463d/);
  assert.match(rendered, /Wallet Type: Employer wallet/);
  assert.doesNotMatch(rendered, /Transaction ID|TOPUP-6aae75ac/);
});

test('a withdrawal receipt identifies the actual payment destination', () => {
  const transaction = {
    _id: '6aae75acb9ef713e37c31abc',
    type: 'PAYOUT',
    status: 'PENDING',
    balanceTarget: 'WORKER',
    amount: 1500,
    provider: 'manual_admin_review',
    createdAt: new Date('2026-09-20T08:00:00.000Z'),
    payoutRequest: {
      destinationSnapshot: {
        methodType: 'bank_transfer',
        institutionName: 'BPI',
      },
    },
  };
  const sections = getReceiptSections(transaction, {
    _id: '6aae75acb9ef12713e37',
    firstName: 'Jonas',
    lastName: 'Enriquez',
  });
  const rendered = sections.flatMap((section) => section.rows).map(([label, value]) => `${label}: ${value}`).join('\n');

  assert.match(rendered, /Payment Method: Bank transfer via BPI/);
  assert.doesNotMatch(rendered, /manual_admin_review/);
});

test('a digital wallet withdrawal uses its recipient-facing method name', () => {
  const sections = getReceiptSections({
    _id: '6aae75acb9ef713e37c31abc',
    type: 'PAYOUT',
    status: 'COMPLETED',
    amount: 500,
    payoutRequest: {
      destinationSnapshot: {
        methodType: 'gcash',
        institutionName: 'GCash',
      },
    },
  }, { _id: 'user-1', firstName: 'Jonas', lastName: 'Enriquez' });
  const details = sections[0].rows;

  assert.equal(details.find(([label]) => label === 'Payment Method')?.[1], 'GCash');
});
