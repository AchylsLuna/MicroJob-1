import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import User from '../../models/User.js';
import Transaction from '../../models/Transaction.js';
import PayoutRequest from '../../models/PayoutRequest.js';
import SupportTicket from '../../models/SupportTicket.js';
import Notification from '../../models/Notification.js';
import AuditLog from '../../models/AuditLog.js';
import {
  createPayoutRequest,
  updateAdminPayoutRequest,
} from '../../controllers/PaymentController.js';
import {
  getSupportTicketById,
  updateAdminSupportTicket,
} from '../../controllers/SupportController.js';
import { getAdminStats, getAdminWalletStats } from '../../controllers/AdminController.js';

let replicaSet;

const response = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

const request = ({ user, body = {}, params = {}, query = {} }) => ({
  user,
  body,
  params,
  query,
  ip: '127.0.0.1',
  get: () => 'admin-critical-flow-test',
});

before(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri(), { dbName: 'admin-critical-flow-tests' });
  await Promise.all([PayoutRequest.init(), Transaction.init(), SupportTicket.init()]);
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Transaction.deleteMany({}),
    PayoutRequest.deleteMany({}),
    SupportTicket.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

async function createWorker(balance = 500) {
  return User.create({
    email: `worker-${new mongoose.Types.ObjectId()}@example.com`,
    firstName: 'Payout',
    lastName: 'Worker',
    role: 'work',
    status: 'active',
    workerBalance: balance,
    passwordHashed: 'not-used',
  });
}

async function submitPayout(worker, { amount = 100, idempotencyKey = 'payout-test-key' } = {}) {
  const res = response();
  await createPayoutRequest(
    request({
      user: { id: String(worker._id), role: worker.role },
      body: {
        amount,
        idempotencyKey,
        destinationSnapshot: {
          methodType: 'bank_transfer',
          institutionName: 'Test Bank',
          accountName: 'Payout Worker',
          accountNumber: '1234567890',
        },
      },
    }),
    res,
  );
  return res;
}

test('payout submission is atomic and idempotent', async () => {
  const worker = await createWorker();
  const [first, concurrentRetry] = await Promise.all([
    submitPayout(worker),
    submitPayout(worker),
  ]);
  const retry = await submitPayout(worker);
  const belowMinimum = await submitPayout(worker, { amount: 0.5, idempotencyKey: 'below-minimum' });
  const excessivePrecision = await submitPayout(worker, { amount: 10.999, idempotencyKey: 'too-precise' });

  assert.deepEqual([first.statusCode, concurrentRetry.statusCode].sort(), [200, 201]);
  assert.equal(retry.statusCode, 200);
  assert.equal(belowMinimum.statusCode, 400);
  assert.equal(excessivePrecision.statusCode, 400);
  assert.equal(await PayoutRequest.countDocuments(), 1);
  assert.equal(await Transaction.countDocuments({ type: 'PAYOUT' }), 1);
  assert.equal((await User.findById(worker._id)).workerBalance, 400);
});

test('payout review enforces state order and concurrent rejection refunds once', async () => {
  const worker = await createWorker();
  const submitted = await submitPayout(worker);
  const payoutId = submitted.payload.payoutRequest._id;
  const adminId = new mongoose.Types.ObjectId();

  const directPaid = response();
  await updateAdminPayoutRequest(
    request({ user: { id: String(adminId), role: 'admin' }, params: { payoutRequestId: payoutId }, body: { status: 'paid' } }),
    directPaid,
  );
  assert.equal(directPaid.statusCode, 409);

  const reject = () => {
    const res = response();
    return updateAdminPayoutRequest(
      request({ user: { id: String(adminId), role: 'admin' }, params: { payoutRequestId: payoutId }, body: { status: 'rejected', reviewNotes: 'Destination could not be verified.' } }),
      res,
    ).then(() => res);
  };
  const [first, second] = await Promise.all([reject(), reject()]);

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(await Transaction.countDocuments({ payoutRequest: payoutId, type: 'REFUND' }), 1);
  assert.equal((await User.findById(worker._id)).workerBalance, 500);
  assert.equal((await PayoutRequest.findById(payoutId)).status, 'rejected');
});

test('support internal notes stay private and do not notify the requester', async () => {
  const [worker, admin] = await Promise.all([
    createWorker(0),
    User.create({
      email: 'support-admin@example.com',
      firstName: 'Support',
      lastName: 'Admin',
      role: 'admin',
      status: 'active',
      passwordHashed: 'not-used',
    }),
  ]);
  const ticket = await SupportTicket.create({
    requester: worker._id,
    subject: 'Private support note test',
    messages: [{ author: worker._id, actorRole: 'user', body: 'Please help.' }],
  });

  const updateResponse = response();
  await updateAdminSupportTicket(
    request({
      user: { id: String(admin._id), role: 'admin' },
      params: { ticketId: String(ticket._id) },
      body: { reviewNotes: 'Check the payment ledger before replying.' },
    }),
    updateResponse,
  );
  assert.equal(updateResponse.statusCode, 200);
  assert.equal(await Notification.countDocuments({ user: worker._id }), 0);

  const userResponse = response();
  await getSupportTicketById(
    request({ user: { id: String(worker._id), role: 'work' }, params: { ticketId: String(ticket._id) } }),
    userResponse,
  );
  assert.equal(userResponse.statusCode, 200);
  assert.equal('internalNotes' in userResponse.payload.data, false);

  const adminResponse = response();
  await getSupportTicketById(
    request({ user: { id: String(admin._id), role: 'admin' }, params: { ticketId: String(ticket._id) } }),
    adminResponse,
  );
  assert.equal(adminResponse.payload.data.internalNotes.length, 1);
  assert.equal(adminResponse.payload.data.internalNotes[0].body, 'Check the payment ledger before replying.');
});

test('admin financial metrics include only completed payouts and outstanding escrow', async () => {
  const jobReference = new mongoose.Types.ObjectId();
  await Transaction.create([
    { amount: 100, type: 'ESCROW', status: 'COMPLETED', balanceTarget: 'ESCROW', jobReference },
    { amount: 40, type: 'PAYOUT', status: 'COMPLETED', balanceTarget: 'WORKER', jobReference },
    { amount: 10, type: 'REFUND', status: 'COMPLETED', balanceTarget: 'EMPLOYER', jobReference },
    { amount: 999, type: 'PAYOUT', status: 'PENDING', balanceTarget: 'WORKER', jobReference },
    { amount: 25, type: 'TOP_UP', status: 'COMPLETED', balanceTarget: 'EMPLOYER' },
  ]);

  const statsResponse = response();
  await getAdminStats({}, statsResponse);
  assert.equal(statsResponse.payload.completedPayoutVolume, 40);

  const walletResponse = response();
  await getAdminWalletStats({}, walletResponse);
  assert.equal(walletResponse.payload.totalEscrow, 50);
});
