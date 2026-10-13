import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import FinancialDispute from '../../models/FinancialDispute.js';
import Transaction from '../../models/Transaction.js';
import User from '../../models/User.js';
import { openPaymentDispute, settleDirect } from '../../controllers/ApplicationPaymentController.js';
import { updateAdminFinancialDispute } from '../../controllers/AdminFinanceDisputeController.js';

let mongo;
const response = () => ({
  statusCode: 200,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});
const makeUser = async (role, email) => {
  const user = new User({ email, firstName: 'Test', lastName: 'User', role, status: 'active' });
  await user.setPassword('Password123!');
  return user.save();
};

before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: 'payment-disputes' });
  await Transaction.init();
});
beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Job.deleteMany({}), JobApplication.deleteMany({}),
    FinancialDispute.deleteMany({}), Transaction.deleteMany({}),
  ]);
});
after(async () => { await mongoose.disconnect(); await mongo.stop(); });

async function makeSubmittedAssignment() {
  const [employer, worker, admin] = await Promise.all([
    makeUser('hire', `employer-${new mongoose.Types.ObjectId()}@example.com`),
    makeUser('work', `worker-${new mongoose.Types.ObjectId()}@example.com`),
    makeUser('superadmin', `admin-${new mongoose.Types.ObjectId()}@example.com`),
  ]);
  const job = await Job.create({
    title: 'Community cleanup',
    description: 'Cleanup',
    location: 'Pasig',
    salary: 500,
    jobType: 'Short-term',
    deadline: new Date('2027-01-01'),
    jobPoster: employer._id,
  });
  const application = await JobApplication.create({
    job: job._id,
    applicant: worker._id,
    status: 'Hired',
    agreedAmount: 500,
    workStatus: 'Submitted',
    paymentStatus: 'Secured',
    workSubmittedAt: new Date(),
  });
  await Transaction.create({
    sender: employer._id,
    amount: 500,
    type: 'ESCROW',
    status: 'COMPLETED',
    balanceTarget: 'ESCROW',
    jobReference: job._id,
  });
  return { employer, worker, admin, job, application };
}

test('either assignment participant can open one dispute and it blocks direct payment', async () => {
  const { worker, employer, application } = await makeSubmittedAssignment();
  const outsider = await makeUser('work', `outsider-${new mongoose.Types.ObjectId()}@example.com`);
  const forbidden = response();
  await openPaymentDispute({
    params: { applicationId: String(application._id) },
    user: { id: String(outsider._id) },
    body: { reason: 'I am not part of this assignment.' },
  }, forbidden);
  assert.equal(forbidden.statusCode, 403);

  const opened = response();

  await openPaymentDispute({
    params: { applicationId: String(application._id) },
    user: { id: String(worker._id) },
    body: { reason: 'The employer has not approved the completed work.' },
  }, opened);

  assert.equal(opened.statusCode, 201);
  assert.equal(opened.payload.dispute.raisedBy.toString(), worker._id.toString());
  assert.equal((await JobApplication.findById(application._id)).paymentStatus, 'Disputed');

  const duplicate = response();
  await openPaymentDispute({
    params: { applicationId: String(application._id) },
    user: { id: String(employer._id) },
    body: { reason: 'The work does not meet the agreed requirements.' },
  }, duplicate);
  assert.equal(duplicate.statusCode, 409);

  const settle = response();
  await settleDirect({
    params: { applicationId: String(application._id) },
    user: { id: String(employer._id) },
  }, settle);
  assert.equal(settle.statusCode, 409);
});

test('finance admin can split escrow and atomically settle the application and dispute', async () => {
  const { employer, worker, admin, job, application } = await makeSubmittedAssignment();
  const opened = response();
  await openPaymentDispute({
    params: { applicationId: String(application._id) },
    user: { id: String(worker._id) },
    body: { reason: 'Only part of the work was accepted.' },
  }, opened);
  const disputeId = String(opened.payload.dispute._id);

  const resolved = response();
  await updateAdminFinancialDispute({
    params: { disputeId },
    user: { id: String(admin._id) },
    body: { status: 'resolved', workerPayoutAmount: 300, resolutionNotes: 'Three completed days are payable.' },
  }, resolved);

  assert.equal(resolved.statusCode, 200);
  assert.equal(resolved.payload.dispute.status, 'resolved');
  assert.equal(resolved.payload.dispute.workerPayoutAmount, 300);
  assert.equal((await User.findById(worker._id)).workerBalance, 300);
  assert.equal((await User.findById(employer._id)).employerBalance, 200);
  assert.equal(await Transaction.countDocuments({ jobReference: job._id, type: 'PAYOUT', reference: `dispute-resolution:${disputeId}:worker` }), 1);
  assert.equal(await Transaction.countDocuments({ jobReference: job._id, type: 'REFUND', reference: `dispute-resolution:${disputeId}:employer` }), 1);
  const settledApplication = await JobApplication.findById(application._id);
  assert.equal(settledApplication.paymentStatus, 'Paid');
  assert.equal(settledApplication.workStatus, 'Completed');

  const duplicateResolution = response();
  await updateAdminFinancialDispute({
    params: { disputeId },
    user: { id: String(admin._id) },
    body: { status: 'resolved', workerPayoutAmount: 500, resolutionNotes: 'Retry' },
  }, duplicateResolution);
  assert.equal(duplicateResolution.statusCode, 409);
  assert.equal((await User.findById(worker._id)).workerBalance, 300);
});

test('rejects a payout outside the agreed amount without changing the dispute or balances', async () => {
  const { employer, worker, admin, application } = await makeSubmittedAssignment();
  const opened = response();
  await openPaymentDispute({
    params: { applicationId: String(application._id) },
    user: { id: String(employer._id) },
    body: { reason: 'The submitted work is incomplete.' },
  }, opened);

  const resolved = response();
  await updateAdminFinancialDispute({
    params: { disputeId: String(opened.payload.dispute._id) },
    user: { id: String(admin._id) },
    body: { status: 'resolved', workerPayoutAmount: 501, resolutionNotes: 'Out of range.' },
  }, resolved);

  assert.equal(resolved.statusCode, 400);
  assert.equal((await FinancialDispute.findById(opened.payload.dispute._id)).status, 'open');
  assert.equal((await User.findById(worker._id)).workerBalance, 0);
  assert.equal((await User.findById(employer._id)).employerBalance, 0);
});

test('allows a zero worker award and returns all disputed escrow to the employer', async () => {
  const { employer, worker, admin, job, application } = await makeSubmittedAssignment();
  const opened = response();
  await openPaymentDispute({
    params: { applicationId: String(application._id) },
    user: { id: String(employer._id) },
    body: { reason: 'The submitted work was not usable.' },
  }, opened);

  const resolved = response();
  await updateAdminFinancialDispute({
    params: { disputeId: String(opened.payload.dispute._id) },
    user: { id: String(admin._id) },
    body: { status: 'resolved', workerPayoutAmount: 0, resolutionNotes: 'No usable work was delivered.' },
  }, resolved);

  assert.equal(resolved.statusCode, 200);
  assert.equal((await User.findById(worker._id)).workerBalance, 0);
  assert.equal((await User.findById(employer._id)).employerBalance, 500);
  assert.equal(await Transaction.countDocuments({ jobReference: job._id, type: 'PAYOUT' }), 0);
  assert.equal(await Transaction.countDocuments({ jobReference: job._id, type: 'REFUND', status: 'COMPLETED' }), 1);
});

test('keeps disputed funds held when escrow is insufficient', async () => {
  const { employer, worker, admin, application } = await makeSubmittedAssignment();
  const opened = response();
  await openPaymentDispute({
    params: { applicationId: String(application._id) },
    user: { id: String(worker._id) },
    body: { reason: 'Payment was not released.' },
  }, opened);
  await Transaction.deleteMany({ type: 'ESCROW' });

  const resolved = response();
  await updateAdminFinancialDispute({
    params: { disputeId: String(opened.payload.dispute._id) },
    user: { id: String(admin._id) },
    body: { status: 'resolved', workerPayoutAmount: 300, resolutionNotes: 'Split decision.' },
  }, resolved);

  assert.equal(resolved.statusCode, 409);
  assert.equal((await FinancialDispute.findById(opened.payload.dispute._id)).status, 'open');
  assert.equal((await JobApplication.findById(application._id)).paymentStatus, 'Disputed');
  assert.equal((await User.findById(worker._id)).workerBalance, 0);
  assert.equal((await User.findById(employer._id)).employerBalance, 0);
});

test('rejects payouts with fractional cents', async () => {
  const { employer, worker, admin, application } = await makeSubmittedAssignment();
  const opened = response();
  await openPaymentDispute({
    params: { applicationId: String(application._id) },
    user: { id: String(employer._id) },
    body: { reason: 'There is a disagreement about the amount.' },
  }, opened);

  const resolved = response();
  await updateAdminFinancialDispute({
    params: { disputeId: String(opened.payload.dispute._id) },
    user: { id: String(admin._id) },
    body: { status: 'resolved', workerPayoutAmount: 300.001, resolutionNotes: 'Invalid fractional cent amount.' },
  }, resolved);

  assert.equal(resolved.statusCode, 400);
  assert.equal((await User.findById(worker._id)).workerBalance, 0);
});
