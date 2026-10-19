import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPaymentReceiptMessage,
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
  assert.doesNotMatch(rendered, /Account ID|Provider Reference|6aae75ac|cs_2b096c10/);
  assert.match(rendered, /Payment Method: Online payment processed by PayMongo/);
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

const receiptUser = { _id: 'private-user-id', firstName: 'Jonas', lastName: 'Enriquez', email: 'jonas@example.com' };
const receiptTransaction = {
  _id: 'private-transaction-id', type: 'PAYOUT', status: 'COMPLETED', amount: 500,
  createdAt: new Date('2026-09-20T08:00:00Z'),
};

test('receipt emails mask account numbers even if the masked field contains a full number', () => {
  for (const account of [
    { accountNumberMasked: '09171234567' },
    { accountNumber: '0917 123 4567' },
    { accountNumberMasked: '****4567' },
    { accountNumber: '1234' },
  ]) {
    const message = buildPaymentReceiptMessage({
      ...receiptTransaction,
      provider: 'manual_admin_review', providerReference: 'secret-provider-reference',
      reference: 'secret-internal-reference', label: 'Internal ticket private-user-id',
      payoutRequest: { destinationSnapshot: { methodType: 'gcash', ...account } },
    }, receiptUser, 'receipts@example.com');
    for (const body of [message.text, message.html]) {
      assert.doesNotMatch(body, /09171234567|0917 123 4567|private-user-id|private-transaction-id|secret-provider-reference|secret-internal-reference|manual_admin_review|Internal ticket/);
      assert.ok(body.includes(account.accountNumber === '1234' ? '****' : '****4567'));
      assert.ok(body.includes('GCash'));
    }
  }
});

test('wallet earnings are described as a wallet credit rather than a withdrawal', () => {
  const message = buildPaymentReceiptMessage(receiptTransaction, receiptUser, 'receipts@example.com');
  assert.equal(message.subject, 'MicroJobs Wallet credit receipt');
  assert.match(message.text, /Payment Method: MicroJobs wallet credit/);
  assert.doesNotMatch(message.text + message.html, /withdrawal|Transfer Successful/i);
});

test('job payment receipts distinguish sender and receiver, include daily dates, and retain the same public receipt number', () => {
  const transaction = { ...receiptTransaction, balanceTarget: 'WORKER', jobReference: { title: 'Daily cleanup', jobPoster: 'employer-id' }, meta: { workDate: '2026-10-19' } };
  const employer = buildPaymentReceiptMessage(transaction, { ...receiptUser, _id: 'employer-id' }, 'receipts@example.test');
  const worker = buildPaymentReceiptMessage(transaction, receiptUser, 'receipts@example.test');
  assert.match(employer.text, /Payment Direction: Payment sent/); assert.match(employer.text, /Wallet Type: Secured job funds/);
  assert.match(worker.text, /Payment Direction: Payment received/); assert.match(worker.text, /MicroJobs worker wallet/);
  for (const mail of [employer, worker]) {
    assert.match(mail.text, /Work Date: 2026-10-19/); assert.match(mail.text, /Daily cleanup/);
    assert.ok(mail.text.includes(getPublicReceiptNumber(transaction))); assert.doesNotMatch(mail.text, /employer-id|private-transaction-id/);
  }
});

test('pending, failed, cancelled and missing statuses never claim successful payment', () => {
  for (const status of ['PENDING', 'FAILED', 'CANCELLED', undefined]) {
    const message = buildPaymentReceiptMessage({
      ...receiptTransaction, status, payoutRequest: { destinationSnapshot: { methodType: 'maya' } },
    }, receiptUser, 'receipts@example.com');
    for (const body of [message.text, message.html]) {
      assert.doesNotMatch(body, /completed successfully|Transaction Status: Successful/);
      assert.match(body, /not a completed payment|not confirmation of a completed payment|status is unavailable/);
    }
  }
});

test('receipt HTML escapes names, job titles and destination details', () => {
  const message = buildPaymentReceiptMessage({
    ...receiptTransaction,
    jobReference: { title: '<script>alert(1)</script>' },
    payoutRequest: { destinationSnapshot: { methodType: 'bank_transfer', institutionName: '<img src=x onerror=alert(1)>', accountName: '<b>Recipient</b>' } },
  }, { ...receiptUser, firstName: '<script>name</script>' }, 'receipts@example.com');
  assert.doesNotMatch(message.html, /<script>|<img|<b>Recipient/);
  assert.match(message.html, /&lt;script&gt;/);
  assert.match(message.html, /&lt;img/);
  assert.match(message.html, /&lt;b&gt;Recipient/);
});

test('top-ups show recorded processing fees, total charged and both wallet destinations', () => {
  const message = buildPaymentReceiptMessage({
    ...receiptTransaction, type: 'TOP_UP', provider: 'xendit-link', balanceTarget: 'SYSTEM',
    meta: { processingFee: 10, totalAmountCharged: 510, target: 'BOTH', secret: 'hidden-metadata' },
  }, receiptUser, 'receipts@example.com');
  assert.match(message.text, /Processing Fee: ₱10\.00/);
  assert.match(message.text, /Total Charged: ₱510\.00/);
  assert.match(message.text, /Employer and worker wallets/);
  assert.match(message.text, /Online payment processed by Xendit/);
  assert.doesNotMatch(message.text + message.html, /hidden-metadata/);
});

test('internal providers are hidden for wallet transfers', () => {
  const message = buildPaymentReceiptMessage({ ...receiptTransaction, type: 'TOP_UP', provider: 'internal_provider_code' }, receiptUser, 'receipts@example.com');
  assert.ok(message.text.includes('Payment Method: Online payment (method not recorded)'));
  assert.doesNotMatch(message.text + message.html, /internal_provider_code/);
});

test('posting fees and other non-transfer transactions do not generate receipts', () => {
  for (const type of ['POSTING_FEE', 'ESCROW', 'REFUND', 'UNKNOWN']) {
    const transaction = { ...receiptTransaction, type };
    assert.equal(buildPaymentReceiptMessage(transaction, receiptUser, 'receipts@example.com'), null);
    assert.deepEqual(getReceiptSections(transaction, receiptUser), []);
  }
});

test('withdrawal receipts omit posting fees even when present in metadata', () => {
  const message = buildPaymentReceiptMessage({
    ...receiptTransaction,
    meta: { postingFee: 50, processingFee: 10, totalAmountCharged: 560 },
    payoutRequest: { destinationSnapshot: { methodType: 'gcash' } },
  }, receiptUser, 'receipts@example.com');
  assert.doesNotMatch(message.text + message.html, /Posting Fee|Processing Fee|Total Charged/i);
});

test('completed withdrawals include their completion time in Manila', () => {
  const message = buildPaymentReceiptMessage({
    ...receiptTransaction,
    payoutRequest: { paidAt: new Date('2026-09-21T08:00:00Z'), destinationSnapshot: { methodType: 'bank_transfer', institutionName: 'BPI' } },
  }, receiptUser, 'receipts@example.com');
  assert.match(message.text, /Transfer Completed \(Asia\/Manila\): Sep 21, 2026, 4:00 PM/);
  assert.match(message.text, /Payment Method: Bank transfer via BPI/);
});
