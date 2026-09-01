import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import User from '../../models/User.js';
import Category from '../../models/Category.js';
import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import { createJob } from '../../controllers/JobController.js';
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
  await Promise.all([User.deleteMany({}), Job.deleteMany({}), JobApplication.deleteMany({}), Category.deleteMany({})]);
});

test('createJob rejects an employer with no company name or logo', async () => {
  const category = await Category.create({ name: 'Cleaning' });
  const employer = await createUser({ role: 'hire', employerBalance: 10000 });

  const res = createResponse();
  await createJob({ body: jobPayload(category), user: { id: employer._id.toString(), role: 'hire' } }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.payload.code, 'EMPLOYER_PROFILE_INCOMPLETE');
  assert.deepEqual(res.payload.missing.sort(), ['avatarUrl', 'companyName']);
  assert.equal(await Job.countDocuments({}), 0, 'no job should be created while the gate blocks');
});

test('createJob proceeds past the gate for a complete employer profile', async () => {
  const category = await Category.create({ name: 'Cleaning' });
  const employer = await createUser({
    role: 'hire',
    companyName: 'Acme Corp',
    avatarUrl: 'https://example.com/logo.png',
    employerBalance: 10000,
  });

  const res = createResponse();
  await createJob({ body: jobPayload(category), user: { id: employer._id.toString(), role: 'hire' } }, res);

  assert.notEqual(res.statusCode, 409, 'a complete profile must not be blocked by the profile gate');
  assert.notEqual(res.payload?.code, 'EMPLOYER_PROFILE_INCOMPLETE');
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
