import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import User from '../../models/User.js';
import Category from '../../models/Category.js';
import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import Transaction from '../../models/Transaction.js';
import { createJob, deleteJob } from '../../controllers/JobController.js';
import { applyForJob } from '../../controllers/JobApplicationController.js';

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

const jobPayload = (category) => ({
  title: 'Test job',
  description: 'A job',
  location: 'Quezon City, Metro Manila',
  salary: 500,
  jobType: 'Short-term',
  deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  category: String(category._id),
});

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'profile-completeness-tests' });
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Job.deleteMany({}), JobApplication.deleteMany({}), Transaction.deleteMany({}), Category.deleteMany({})]);
});

test('createJob rejects an employer with no logo', async () => {
  const category = await Category.create({ name: 'Cleaning' });
  const employer = await createUser({ role: 'hire', employerBalance: 10000 });

  const res = createResponse();
  await createJob({ body: jobPayload(category), user: { id: employer._id.toString(), role: 'hire' } }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.payload.code, 'EMPLOYER_PROFILE_INCOMPLETE');
  assert.deepEqual(res.payload.missing.sort(), ['avatarUrl']);
  assert.equal(await Job.countDocuments({}), 0, 'no job should be created while the gate blocks');
});

test('createJob proceeds past the gate for an employer with a logo but no company name', async () => {
  const category = await Category.create({ name: 'Cleaning' });
  const employer = await createUser({
    role: 'hire',
    avatarUrl: 'https://example.com/logo.png',
    employerBalance: 10000,
  });

  const res = createResponse();
  await createJob({ body: jobPayload(category), user: { id: employer._id.toString(), role: 'hire' } }, res);

  assert.notEqual(res.statusCode, 409, 'a logo alone must be enough to pass the profile gate');
  assert.notEqual(res.payload?.code, 'EMPLOYER_PROFILE_INCOMPLETE');
});

test('posting and highlight fees are charged separately and are not returned when a listing is deleted', async () => {
  const category = await Category.create({ name: 'Cleaning' });
  const employer = await createUser({
    role: 'hire',
    avatarUrl: 'https://example.com/logo.png',
    employerBalance: 1000,
  });
  const createRes = createResponse();
  await createJob({
    body: { ...jobPayload(category), highlighted: true },
    user: { id: employer._id.toString(), role: 'hire' },
  }, createRes);

  assert.equal(createRes.statusCode, 201);
  assert.equal(createRes.payload.job.salary, 500, 'the worker pay remains the advertised escrow amount');
  assert.equal(createRes.payload.job.highlighted, true);
  assert.equal(createRes.payload.job.postingFee, 20);
  assert.equal(createRes.payload.job.highlightFee, 50);
  assert.equal((await User.findById(employer._id)).employerBalance, 430);
  assert.deepEqual(
    (await Transaction.find({ jobReference: createRes.payload.job._id }).sort({ amount: 1 })).map((tx) => [tx.type, tx.amount]),
    [['POSTING_FEE', 20], ['POSTING_FEE', 50], ['ESCROW', 500]],
  );

  const deleteRes = createResponse();
  await deleteJob({ params: { id: createRes.payload.job._id.toString() }, user: { id: employer._id.toString(), role: 'hire' } }, deleteRes);
  assert.equal(deleteRes.statusCode, 200);
  assert.equal((await User.findById(employer._id)).employerBalance, 930, 'only escrow is refunded');
});

test('applyForJob rejects a worker with no profile photo', async () => {
  const employer = await createUser({ role: 'hire', companyName: 'Acme', avatarUrl: 'https://x/logo.png' });
  const worker = await createUser({ role: 'work' });
  const job = await Job.create({
    title: 'Test job',
    description: 'A job',
    location: 'Quezon City',
    salary: 500,
    jobType: 'Short-term',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    jobPoster: employer._id,
  });

  const res = createResponse();
  await applyForJob({ params: { jobId: job._id.toString() }, body: {}, user: { id: worker._id.toString() } }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.payload.code, 'WORKER_PROFILE_INCOMPLETE');
  assert.equal(await JobApplication.countDocuments({}), 0, 'no application should be created while the gate blocks');
});

test('applyForJob proceeds past the gate for a worker with a profile photo', async () => {
  const employer = await createUser({ role: 'hire', companyName: 'Acme', avatarUrl: 'https://x/logo.png' });
  const worker = await createUser({ role: 'work', avatarUrl: 'https://x/worker.jpg' });
  const job = await Job.create({
    title: 'Test job',
    description: 'A job',
    location: 'Quezon City',
    salary: 500,
    jobType: 'Short-term',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    jobPoster: employer._id,
  });

  const res = createResponse();
  await applyForJob({ params: { jobId: job._id.toString() }, body: {}, user: { id: worker._id.toString() } }, res);

  assert.equal(res.statusCode, 201, 'a worker with a photo must be able to apply');
  assert.equal(await JobApplication.countDocuments({}), 1);
});
