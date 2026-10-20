import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import Job from '../../models/Job.js';
import Transaction from '../../models/Transaction.js';
import User from '../../models/User.js';
import Category from '../../models/Category.js';
import { createJob, updateJob } from '../../controllers/JobController.js';

let mongoServer;

const createResponse = () => ({
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

const createEmployer = async (employerBalance = 0) => {
  const user = new User({
    email: `${new mongoose.Types.ObjectId()}@example.com`,
    firstName: 'Test',
    lastName: 'Employer',
    role: 'hire',
    status: 'active',
    employerBalance,
  });
  await user.setPassword('Password123!');
  return user.save();
};

const createFundedJob = async (jobPoster, overrides = {}) => { const job = await Job.create({
  title: 'Funded local job',
  description: 'A funded job used to verify escrow adjustments.',
  location: 'Pasig City, Metro Manila',
  salary: 1000,
  jobType: 'Short-term',
  deadline: new Date('2027-01-01T00:00:00.000Z'),
  positionsNeeded: 1,
  jobPoster,
  ...overrides,
});
  await Transaction.create({ sender: jobPoster, amount: job.salary * job.positionsNeeded, type: 'ESCROW', status: 'COMPLETED', balanceTarget: 'ESCROW', jobReference: job._id });
  return job;
};

const update = async (employer, job, body) => {
  const response = createResponse();
  await updateJob({
    params: { id: String(job._id) },
    user: { id: String(employer._id), role: employer.role },
    body,
  }, response);
  return response;
};

before(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri(), { dbName: 'job-escrow-update-tests' });
});

beforeEach(async () => { for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({}); });

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test('increasing funded job pay or positions collects only the escrow difference', async () => {
  const employer = await createEmployer(1500);
  const job = await createFundedJob(employer._id);

  const response = await update(employer, job, { salary: 1200, positionsNeeded: 2 });

  assert.equal(response.statusCode, 200);
  const [updatedEmployer, updatedJob, transaction] = await Promise.all([
    User.findById(employer._id),
    Job.findById(job._id),
    Transaction.findOne({ jobReference: job._id, type: 'ESCROW', 'meta.previousTotal': { $exists: true } }),
  ]);
  assert.equal(updatedEmployer.employerBalance, 100);
  assert.equal(updatedJob.salary, 1200);
  assert.equal(updatedJob.positionsNeeded, 2);
  assert.equal(transaction.amount, 1400);
  assert.equal(transaction.meta.previousTotal, 1000);
  assert.equal(transaction.meta.updatedTotal, 2400);
});

test('job edits reject pay below the type minimum without changing funding', async () => {
  const employer = await createEmployer(100);
  for (const [jobType, minimum] of [['Recruiting', 480], ['Short-term', 50], ['Side hustle', 50]]) {
    const job = await createFundedJob(employer._id, { jobType });
    const response = await update(employer, job, { salary: minimum - 0.01 });
    assert.equal(response.statusCode, 400);
    assert.match(response.payload.message, new RegExp(`at least PHP ${minimum}`));
    assert.equal((await Job.findById(job._id)).salary, 1000);
    assert.equal((await User.findById(employer._id)).employerBalance, 100);
    assert.equal(await Transaction.countDocuments({ jobReference: job._id }), 1);
    const accepted = await update(employer, job, { salary: minimum });
    assert.equal(accepted.statusCode, 200);
    assert.equal((await Job.findById(job._id)).salary, minimum);
    // Reset the balance after checking the successful refund.
    await User.updateOne({ _id: employer._id }, { employerBalance: 100 });
  }
});

test('new postings reject below-minimum pay and accept the exact minimum', async () => {
  const employer = await createEmployer(2000);
  await User.updateOne({ _id: employer._id }, { companyName: 'Test Employer', avatarUrl: '/uploads/test.png' });
  const category = await Category.create({ name: 'Local services' });
  for (const [jobType, minimum] of [['Recruiting', 480], ['Short-term', 50], ['Side hustle', 50]]) {
    const body = {
      title: 'Local work', description: 'Help with local services.', location: 'Pasig City',
      jobType, ...(jobType === 'Recruiting' ? { workDates: ['2027-01-02', '2027-01-03'], workStartTime: '08:00', workEndTime: '17:00' } : {}), salary: minimum - 0.01, category: String(category._id),
      deadline: '2027-01-01T00:00:00.000Z', positionsNeeded: 1,
    };
    const response = createResponse();
    const user = { id: String(employer._id), role: employer.role };
    await createJob({ user, body }, response);
    assert.equal(response.statusCode, 400);
    assert.match(response.payload.message, new RegExp(`at least PHP ${minimum}`));
    assert.equal(await Job.countDocuments({ jobType }), 0);
    const accepted = createResponse();
    await createJob({ user, body: { ...body, salary: minimum } }, accepted);
    assert.equal(accepted.statusCode, 201);
    assert.equal((await Job.findOne({ jobType })).salary, minimum);
  }
});

test('changing only the opportunity type validates the existing pay', async () => {
  const employer = await createEmployer(910);
  const job = await createFundedJob(employer._id, { salary: 50 });
  const response = await update(employer, job, { jobType: 'Recruiting' });
  assert.equal(response.statusCode, 400);
  assert.equal((await Job.findById(job._id)).jobType, 'Short-term');
  const accepted = await update(employer, job, { jobType: 'Recruiting', salary: 480, workDates: ['2027-01-02', '2027-01-03'], workStartTime: '08:00', workEndTime: '17:00' });
  assert.equal(accepted.statusCode, 200);
  const updatedJob = await Job.findById(job._id);
  assert.equal(updatedJob.jobType, 'Recruiting');
  assert.equal(updatedJob.salary, 480);
});

test('reducing funded job pay or positions refunds the escrow difference', async () => {
  const employer = await createEmployer(100);
  const job = await createFundedJob(employer._id, { salary: 1000, positionsNeeded: 2 });

  const response = await update(employer, job, { salary: 800, positionsNeeded: 1 });

  assert.equal(response.statusCode, 200);
  const [updatedEmployer, transaction] = await Promise.all([
    User.findById(employer._id),
    Transaction.findOne({ jobReference: job._id, type: 'REFUND' }),
  ]);
  assert.equal(updatedEmployer.employerBalance, 1300);
  assert.equal(transaction.amount, 1200);
});

test('insufficient balance rejects the edit without changing the wallet or job', async () => {
  const employer = await createEmployer(100);
  const job = await createFundedJob(employer._id);

  const response = await update(employer, job, { salary: 1500 });

  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.code, 'INSUFFICIENT_BALANCE');
  assert.equal(response.payload.shortfall, 400);
  const [unchangedEmployer, unchangedJob, transactionCount] = await Promise.all([
    User.findById(employer._id),
    Job.findById(job._id),
    Transaction.countDocuments({ jobReference: job._id }),
  ]);
  assert.equal(unchangedEmployer.employerBalance, 100);
  assert.equal(unchangedJob.salary, 1000);
  assert.equal(transactionCount, 1);
});

test('workers needed cannot be reduced below the number already hired', async () => {
  const employer = await createEmployer(100);
  const job = await createFundedJob(employer._id, { positionsNeeded: 2, hiredCount: 2, status: 'Closed' });

  const response = await update(employer, job, { positionsNeeded: 1 });

  assert.equal(response.statusCode, 400);
  assert.match(response.payload.message, /already hired/);
  const unchangedJob = await Job.findById(job._id);
  assert.equal(unchangedJob.positionsNeeded, 2);
});
