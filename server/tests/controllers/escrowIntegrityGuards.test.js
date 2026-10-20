import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import User from '../../models/User.js';
import Category from '../../models/Category.js';
import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import Transaction from '../../models/Transaction.js';
import { changeJobStatus, createJob, updateJob } from '../../controllers/JobController.js';
import { resolvePublicId } from '../../lib/publicId.js';

/**
 * Regression guards for the escrow money paths.
 *
 * Every case here corresponds to a defect that was live on this branch and that
 * nothing asserted, so each would silently come back without these.
 */

let mongoServer;

const createResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

const createUser = async (overrides) => {
  const user = new User({
    email: `${new mongoose.Types.ObjectId()}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    status: 'active',
    ...overrides,
  });
  await user.setPassword('Password123!');
  return user.save();
};

const jobPayload = (category, overrides = {}) => ({
  title: 'Test job',
  description: 'A job',
  location: 'Quezon City, Metro Manila',
  salary: 500,
  jobType: 'Short-term',
  deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  category: String(category._id),
  ...overrides,
});

const employerRequest = (employer, body = {}, params = {}) => ({
  body,
  params,
  user: { id: employer._id.toString(), role: 'hire' },
  ip: '127.0.0.1',
  get: () => 'test',
  headers: {},
});

before(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri(), { dbName: 'escrow-integrity-tests' });
  // The partial unique index on `reference` is what makes the refund paths
  // idempotent, so it has to exist before these assertions mean anything.
  await Transaction.init();
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Job.deleteMany({}), JobApplication.deleteMany({}),
    Transaction.deleteMany({}), Category.deleteMany({}),
  ]);
});

/**
 * createJob used to read the balance, compare it to the cost, mutate the
 * document in memory and `save()` -- a lost update. Concurrent posts all read
 * the same starting balance, all passed the check, and each wrote its own
 * result, so N jobs existed while the wallet was debited once. Refunding each
 * job's escrow then netted the attacker the difference, repeatably.
 */
test('concurrent job posts cannot spend the same balance twice', async () => {
  const category = await Category.create({ name: 'Cleaning' });
  // 570 funds exactly one 500 + 20 posting fee job, with too little left for a second.
  const employer = await createUser({
    role: 'hire',
    avatarUrl: 'https://example.com/logo.png',
    employerBalance: 570,
  });

  const responses = [createResponse(), createResponse(), createResponse(), createResponse()];
  await Promise.all(responses.map((res) => createJob(employerRequest(employer, jobPayload(category)), res)));

  const created = responses.filter((res) => res.statusCode === 201);
  assert.equal(created.length, 1, 'exactly one of the racing posts may succeed');
  assert.equal(await Job.countDocuments({}), 1);

  const after = await User.findById(employer._id);
  assert.equal(after.employerBalance, 50, 'the balance is debited exactly once');
  assert.ok(after.employerBalance >= 0, 'the balance may never go negative');
  assert.equal(await Transaction.countDocuments({ type: 'ESCROW' }), 1, 'one escrow row per funded job');
});

/**
 * The cancel refund carried no `reference` at all. Transaction's uniqueness
 * guard is a *partial* index (`reference: { $type: 'string' }`), so a null
 * reference is excluded from the index entirely and unlimited duplicates were
 * permitted -- two cancels could both refund, and even serially they left two
 * REFUND rows against one credit, corrupting the escrow maths downstream.
 */
test('cancelling a job twice refunds its escrow exactly once', async () => {
  const category = await Category.create({ name: 'Cleaning' });
  const employer = await createUser({
    role: 'hire',
    avatarUrl: 'https://example.com/logo.png',
    employerBalance: 1000,
  });

  const createRes = createResponse();
  await createJob(employerRequest(employer, jobPayload(category)), createRes);
  assert.equal(createRes.statusCode, 201);
  const publicJobId = createRes.payload.job._id.toString();
  const jobId = resolvePublicId(publicJobId);

  const balanceAfterPost = (await User.findById(employer._id)).employerBalance;

  const firstCancel = createResponse();
  await changeJobStatus(employerRequest(employer, { status: 'Cancelled', reason: 'No longer needed', policyAcknowledged: true }, { id: publicJobId }), firstCancel);
  assert.equal(firstCancel.statusCode, 200);

  // Re-running the same transition must not pay again. The guard is the unique
  // reference, not the in-memory status read.
  const secondCancel = createResponse();
  await changeJobStatus(employerRequest(employer, { status: 'Cancelled', reason: 'No longer needed', policyAcknowledged: true }, { id: publicJobId }), secondCancel);

  const refunds = await Transaction.find({ jobReference: jobId, type: 'REFUND' });
  assert.equal(refunds.length, 1, 'exactly one REFUND row may exist');
  assert.equal(refunds[0].reference, `job-cancellation-refund:${jobId}`, 'the refund must be uniquely referenced');
  assert.equal(
    (await User.findById(employer._id)).employerBalance,
    balanceAfterPost + 500,
    'only the escrowed worker pay comes back, and only once',
  );
});

/**
 * `updateJob` guarded `positionsNeeded` against the hired commitment but not
 * `salary`, while `escrowDifference` is driven by salary x positions -- so a
 * negative difference refunded to the employer. An employer could hire at 1000,
 * wait for the work, then set salary to 1 and withdraw 999, after which
 * settleApplicationPayment threw 409 and the worker was permanently unpayable.
 */
test('minimum pay cannot be cut once a worker is hired', async () => {
  const category = await Category.create({ name: 'Cleaning' });
  const employer = await createUser({
    role: 'hire',
    avatarUrl: 'https://example.com/logo.png',
    employerBalance: 5000,
  });

  const createRes = createResponse();
  await createJob(employerRequest(employer, jobPayload(category)), createRes);
  assert.equal(createRes.statusCode, 201);
  const publicJobId = createRes.payload.job._id.toString();
  const jobId = resolvePublicId(publicJobId);

  await Job.updateOne({ _id: jobId }, { $set: { hiredCount: 1 } });
  const balanceBefore = (await User.findById(employer._id)).employerBalance;

  const res = createResponse();
  await updateJob(employerRequest(employer, { salary: 1 }, { id: publicJobId }), res);

  assert.equal(res.statusCode, 409);
  assert.match(res.payload.message, /fix the job minimum pay/i);
  assert.equal((await Job.findById(jobId)).salary, 500, 'the advertised pay is unchanged');
  assert.equal(
    (await User.findById(employer._id)).employerBalance,
    balanceBefore,
    'no escrow may be withdrawn out from under a hired worker',
  );
  assert.equal(await Transaction.countDocuments({ jobReference: jobId, type: 'REFUND' }), 0);
});

/** Existing agreed offers and hires keep their minimum pay unchanged. */
test('minimum pay remains fixed while a worker is hired', async () => {
  const category = await Category.create({ name: 'Cleaning' });
  const employer = await createUser({
    role: 'hire',
    avatarUrl: 'https://example.com/logo.png',
    employerBalance: 5000,
  });

  const createRes = createResponse();
  await createJob(employerRequest(employer, jobPayload(category)), createRes);
  const publicJobId = createRes.payload.job._id.toString();
  const jobId = resolvePublicId(publicJobId);
  await Job.updateOne({ _id: jobId }, { $set: { hiredCount: 1 } });

  const res = createResponse();
  await updateJob(employerRequest(employer, { salary: 800 }, { id: publicJobId }), res);

  assert.equal(res.statusCode, 409);
  assert.equal((await Job.findById(jobId)).salary, 500);
});

/**
 * Completion used to pay `Math.min(owed, remainingEscrow)` and still flip the
 * application to paymentStatus 'Paid' / workStatus 'Completed'. After that
 * settleApplicationPayment short-circuits on 'Paid' and canUnhireApplication
 * refuses with "already been paid", so the shortfall was unrecoverable through
 * every API path. Worse, the leftover-escrow refund after the loop would have
 * handed a skipped worker's money to the employer.
 */
test('a job whose escrow cannot cover a hired worker in full refuses to complete', async () => {
  const category = await Category.create({ name: 'Cleaning' });
  const employer = await createUser({
    role: 'hire',
    avatarUrl: 'https://example.com/logo.png',
    employerBalance: 5000,
  });
  const worker = await createUser({ role: 'work', avatarUrl: 'https://example.com/w.png' });

  const createRes = createResponse();
  await createJob(employerRequest(employer, jobPayload(category)), createRes);
  const publicJobId = createRes.payload.job._id.toString();
  const jobId = resolvePublicId(publicJobId);

  // A worker owed more than the job's escrow ever held, with the work submitted
  // so the completion path reaches the payout loop.
  await JobApplication.create({
    job: jobId,
    applicant: worker._id,
    status: 'Hired',
    agreedAmount: 900,
    workStatus: 'Submitted',
    paymentStatus: 'Secured',
  });
  await Job.updateOne({ _id: jobId }, { $set: { hiredCount: 1, status: 'Closed' } });

  const res = createResponse();
  await changeJobStatus(employerRequest(employer, { status: 'Completed', confirmed: true }, { id: publicJobId }), res);

  assert.equal(res.statusCode, 409);
  assert.match(res.payload.message, /insufficient/i);

  const application = await JobApplication.findOne({ job: jobId });
  assert.equal(application.paymentStatus, 'Secured', 'a short payout must not be recorded as Paid');
  assert.equal(await Transaction.countDocuments({ jobReference: jobId, type: 'PAYOUT' }), 0, 'nothing is paid out');
  assert.equal((await User.findById(worker._id)).workerBalance || 0, 0);
  assert.equal(
    await Transaction.countDocuments({ jobReference: jobId, type: 'REFUND' }),
    0,
    "the unpaid worker's escrow must not be refunded to the employer",
  );
  assert.notEqual((await Job.findById(jobId)).status, 'Completed', 'the job stays open so the hire can still be paid');
});
