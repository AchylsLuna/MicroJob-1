import { previewWithdrawal } from '../../services/withdrawals.js';
import NotificationOutbox from '../../models/NotificationOutbox.js';
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import User from '../../models/User.js';
import Job from '../../models/Job.js';
import Category from '../../models/Category.js';
import Transaction from '../../models/Transaction.js';
import PayoutRequest from '../../models/PayoutRequest.js';
import SupportTicket from '../../models/SupportTicket.js';
import Notification from '../../models/Notification.js';
import AuditLog from '../../models/AuditLog.js';
import Session from '../../models/Session.js';
import {
  createPayoutRequest,
  updateAdminPayoutRequest,
} from '../../controllers/PaymentController.js';
import {
  getSupportTicketById,
  updateAdminSupportTicket,
} from '../../controllers/SupportController.js';
import {
  banAdminUser,
  getAdminAnalyticsData,
  getAdminStats,
  getAdminUserList,
  getAdminWalletStats,
  unlockAdminUser,
  updateAdminUserSuspiciousFlag,
} from '../../controllers/AdminController.js';

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
  await Promise.all([NotificationOutbox.init(), PayoutRequest.init(), Transaction.init(), SupportTicket.init()]);
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Job.deleteMany({}),
    Category.deleteMany({}),
    Transaction.deleteMany({}),
    PayoutRequest.deleteMany({}),
    SupportTicket.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
    Session.deleteMany({}),
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

async function createEmployer(balance = 500) {
  return User.create({
    email: `employer-${new mongoose.Types.ObjectId()}@example.com`,
    firstName: 'Payout',
    lastName: 'Employer',
    role: 'hire',
    status: 'active',
    employerBalance: balance,
    passwordHashed: 'not-used',
  });
}
const previews = new Map();
async function submitPayout(worker, { amount = 100, idempotencyKey = 'payout-test-key' } = {}) {
  const res = response(); const key = `${worker._id}:${idempotencyKey}`;
  try {
    if (!previews.has(key)) previews.set(key, previewWithdrawal(worker._id, { amount, destinationSnapshot: { methodType: 'bank_transfer', institutionName: 'Test Bank', accountName: 'Payout Worker', accountNumber: '1234567890' } }));
    const preview = await previews.get(key);
    await createPayoutRequest(request({ user: { id: String(worker._id), role: worker.role }, body: { previewToken: preview.previewToken, detailsConfirmed: true } }), res);
  } catch (error) { res.status(error.status || 500).json({ message: error.message }); }
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

test('employer withdrawals can be reviewed by Finance without automatic transfer configuration', async () => {
  const employer = await createEmployer();
  const enabled = process.env.AUTOMATIC_WITHDRAWALS_ENABLED;
  delete process.env.AUTOMATIC_WITHDRAWALS_ENABLED;
  try {
    const preview = await previewWithdrawal(employer._id, { sourceWallet: 'EMPLOYER', amount: 125,
      destinationSnapshot: { methodType: 'bank_transfer', institutionName: 'Test Bank', accountName: 'Employer', accountNumber: '1234567890' } });
    assert.equal(preview.processingMode, 'manual');
    assert.equal(preview.requiresReview, true);
    assert.equal((await User.findById(employer._id)).employerBalance, 500);
    assert.equal(await PayoutRequest.countDocuments(), 0);
    assert.equal(await Transaction.countDocuments(), 0);
  } finally {
    if (enabled !== undefined) process.env.AUTOMATIC_WITHDRAWALS_ENABLED = enabled;
  }
});

test('payout review enforces state order and concurrent rejection refunds once', async () => {
  const worker = await createWorker();
  const submitted = await submitPayout(worker);
  const payoutId = submitted.payload.payoutRequest._id;
  const adminId = new mongoose.Types.ObjectId();

  const directPaid = response();
  await updateAdminPayoutRequest(
    request({ user: { id: String(adminId), role: 'admin' }, params: { payoutRequestId: payoutId }, body: { status: 'paid', transferReference: 'bank-transfer-test' } }),
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

test('analytics staff receive real aggregates without personal or payment-party data', async () => {
  const [employer, worker, category] = await Promise.all([
    createEmployer(0),
    createWorker(0),
    Category.create({ name: 'Analytics' }),
  ]);
  await Job.create({
    title: 'Sanitized job',
    description: 'Visible aggregate fixture',
    location: 'Manila',
    salary: 500,
    jobType: 'Short-term',
    deadline: new Date(Date.now() + 86400000),
    jobPoster: employer._id,
    category: category._id,
    applicants: [worker._id],
  });
  await Transaction.create({
    sender: employer._id,
    receiver: worker._id,
    amount: 500,
    type: 'PAYOUT',
    status: 'COMPLETED',
    balanceTarget: 'WORKER',
    reference: 'private-reference',
  });

  const res = response();
  await getAdminAnalyticsData(request({ user: { role: 'admin', staffRole: 'analytics_team' } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.stats.totalUsers, 2);
  assert.equal(res.payload.stats.uniqueApplicants, 1);
  assert.equal(res.payload.stats.completedPayoutVolume, 500);
  assert.equal(res.payload.jobs[0].applicantsCount, 1);
  assert.deepEqual(res.payload.jobs[0].applicants, []);
  assert.equal(res.payload.jobs[0].jobPoster, null);
  assert.equal(res.payload.users[0].email, '');
  assert.equal(res.payload.transactions[0].sender, null);
  assert.equal(res.payload.transactions[0].receiver, null);
  assert.equal(res.payload.transactions[0].reference, '');
});

test('support account recovery exposes lock state but not verification document URLs', async () => {
  const [user, staffAccount, superadmin] = await Promise.all([User.create({
    email: 'support-target@example.com',
    firstName: 'Support',
    lastName: 'Target',
    role: 'work',
    status: 'active',
    passwordHashed: 'not-used',
    lockUntil: new Date(Date.now() + 60_000),
    failedLoginAttempts: 3,
    loginLockCount: 1,
    verification: {
      identityDocument: { status: 'in-review', documentUrl: '/uploads/private-id.png' },
      addressDocument: { status: 'in-review', documentUrl: '/uploads/private-address.png' },
    },
  }), User.create({
    email: 'staff-list-target@example.com',
    firstName: 'Listed',
    lastName: 'Moderator',
    role: 'admin',
    staffRole: 'moderator',
    status: 'active',
    passwordHashed: 'not-used',
  }), User.create({
    email: 'hidden-owner@example.com',
    firstName: 'Hidden',
    lastName: 'Owner',
    role: 'superadmin',
    status: 'active',
    passwordHashed: 'not-used',
  })]);

  const supportList = response();
  await getAdminUserList(request({ user: { role: 'admin', staffRole: 'support_staff' } }), supportList);
  const supportView = supportList.payload.find((item) => String(item._id) === String(user._id));
  assert.equal(supportView.loginLocked, true);
  assert.equal(supportView.verification.identityDocument.documentUrl, undefined);
  assert.equal(supportView.verification.addressDocument.documentUrl, undefined);
  assert.equal(supportList.payload.some((item) => String(item._id) === String(staffAccount._id)), false);
  assert.equal(supportList.payload.some((item) => String(item._id) === String(superadmin._id)), false);

  const moderatorList = response();
  await getAdminUserList(request({ user: { role: 'admin', staffRole: 'moderator' } }), moderatorList);
  const moderatorView = moderatorList.payload.find((item) => String(item._id) === String(user._id));
  assert.equal(moderatorView.verification.identityDocument.documentUrl, '/uploads/private-id.png');
  assert.equal(moderatorList.payload.some((item) => String(item._id) === String(staffAccount._id)), true);
  assert.equal(moderatorList.payload.some((item) => String(item._id) === String(superadmin._id)), false);

  const unlocked = response();
  await unlockAdminUser(request({
    user: { role: 'admin', staffRole: 'support_staff' },
    params: { userId: String(user._id) },
  }), unlocked);
  assert.equal(unlocked.statusCode, 200);
  const lockState = await User.findById(user._id).select('+lockUntil +failedLoginAttempts +loginLockCount');
  assert.equal(lockState.lockUntil, null);
  assert.equal(lockState.failedLoginAttempts, 0);
  assert.equal(lockState.loginLockCount, 0);
});

test('support and finance can persist and clear suspicious-user flags', async () => {
  const [target, support, finance] = await Promise.all([
    createWorker(0),
    User.create({
      email: 'flag-support@example.com',
      firstName: 'Flag',
      lastName: 'Support',
      role: 'admin',
      staffRole: 'support_staff',
      status: 'active',
      passwordHashed: 'not-used',
    }),
    User.create({
      email: 'flag-finance@example.com',
      firstName: 'Flag',
      lastName: 'Finance',
      role: 'admin',
      staffRole: 'finance_team',
      status: 'active',
      passwordHashed: 'not-used',
    }),
  ]);

  const missingReason = response();
  await updateAdminUserSuspiciousFlag(request({
    user: { id: String(support._id), role: 'admin', staffRole: 'support_staff' },
    params: { userId: String(target._id) },
    body: { flagged: true },
  }), missingReason);
  assert.equal(missingReason.statusCode, 400);

  const flagged = response();
  await updateAdminUserSuspiciousFlag(request({
    user: { id: String(support._id), role: 'admin', staffRole: 'support_staff' },
    params: { userId: String(target._id) },
    body: { flagged: true, reason: 'Multiple identity and payment inconsistencies.' },
  }), flagged);
  assert.equal(flagged.statusCode, 200);
  let stored = await User.findById(target._id);
  assert.equal(stored.suspiciousFlagged, true);
  assert.equal(stored.suspiciousFlagReason, 'Multiple identity and payment inconsistencies.');
  assert.equal(String(stored.suspiciousFlaggedBy), String(support._id));
  assert.ok(stored.suspiciousFlaggedAt instanceof Date);

  const cleared = response();
  await updateAdminUserSuspiciousFlag(request({
    user: { id: String(finance._id), role: 'admin', staffRole: 'finance_team' },
    params: { userId: String(target._id) },
    body: { flagged: false },
  }), cleared);
  assert.equal(cleared.statusCode, 200);
  stored = await User.findById(target._id);
  assert.equal(stored.suspiciousFlagged, false);
  assert.equal(stored.suspiciousFlagReason, null);
  assert.equal(stored.suspiciousFlaggedBy, null);
  assert.equal(stored.suspiciousFlaggedAt, null);
});

test('moderator bans persist a reason and terminate active sessions', async () => {
  const [target, moderator] = await Promise.all([
    createWorker(0),
    User.create({
      email: 'moderator@example.com',
      firstName: 'Queue',
      lastName: 'Moderator',
      role: 'admin',
      staffRole: 'moderator',
      status: 'active',
      passwordHashed: 'not-used',
    }),
  ]);
  const session = await Session.create({ user: target._id, active: true, expiresAt: new Date(Date.now() + 86400000) });

  const res = response();
  await banAdminUser(request({
    user: { id: String(moderator._id), role: 'admin', staffRole: 'moderator' },
    params: { userId: String(target._id) },
    body: { reason: 'Repeated marketplace fraud reports.' },
  }), res);

  assert.equal(res.statusCode, 200);
  const [updatedUser, updatedSession] = await Promise.all([
    User.findById(target._id),
    Session.findById(session._id),
  ]);
  assert.equal(updatedUser.status, 'banned');
  assert.equal(updatedUser.banReason, 'Repeated marketplace fraud reports.');
  assert.equal(String(updatedUser.bannedBy), String(moderator._id));
  assert.equal(updatedSession.active, false);
  assert.ok(updatedSession.endedAt instanceof Date);
});
