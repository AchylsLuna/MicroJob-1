import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import User from '../../models/User.js';
import Job from '../../models/Job.js';
import Category from '../../models/Category.js';
import JobApplication from '../../models/JobApplication.js';
import { getProfile } from '../../controllers/ProfileController.js';

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

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'profile-stats-tests' });
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Job.deleteMany({}), Category.deleteMany({}), JobApplication.deleteMany({})]);
});

/**
 * Regression guard for the bug found while verifying the design agent's plan:
 * getProfile used to compute worker stats (jobsApplied/projectsCompleted/
 * successRate) unconditionally for every role, then PERSIST the result back
 * onto the user document via User.updateOne — including for pure employers,
 * who have zero JobApplication rows as an applicant. Every profile load
 * silently zeroed a real employer's successRate.
 */
test("a pure employer's successRate is never zeroed by loading their profile", async () => {
  const employer = await createUser({ role: 'hire', companyName: 'Acme', successRate: '87%' });

  const res = createResponse();
  await getProfile({ user: { id: employer._id.toString() } }, res);

  assert.equal(res.statusCode, 200);
  assert.notEqual(res.payload.data.successRate, '0%', 'the pre-existing successRate must survive');
  assert.equal(res.payload.data.successRate, '87%');

  const reloaded = await User.findById(employer._id);
  assert.equal(reloaded.successRate, '87%', 'the stored document must not have been overwritten either');
});

test('an employer sees real jobsPosted, totalApplicants, and employerSuccessRate', async () => {
  const employer = await createUser({ role: 'hire', companyName: 'Acme' });
  const worker1 = await createUser({ role: 'work' });
  const worker2 = await createUser({ role: 'work' });
  const category = await Category.create({ name: 'Cleaning' });

  const jobPayload = {
    title: 'Test job', description: 'A job', location: 'Quezon City', salary: 500,
    jobType: 'Short-term', deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    category: category._id, jobPoster: employer._id,
  };
  const [jobA, jobB] = await Promise.all([Job.create(jobPayload), Job.create(jobPayload)]);
  await JobApplication.create({ job: jobA._id, applicant: worker1._id, status: 'Hired' });
  await JobApplication.create({ job: jobB._id, applicant: worker2._id, status: 'Applied' });

  const res = createResponse();
  await getProfile({ user: { id: employer._id.toString() } }, res);

  assert.equal(res.payload.data.jobsPosted, 2);
  assert.equal(res.payload.data.totalApplicants, 2);
  assert.equal(res.payload.data.employerSuccessRate, '50%');
});

test('a worker still gets real, freshly-computed worker stats (no regression)', async () => {
  const worker = await createUser({ role: 'work' });
  const employer = await createUser({ role: 'hire' });
  const category = await Category.create({ name: 'Cleaning' });
  const job = await Job.create({
    title: 'Test job', description: 'A job', location: 'Quezon City', salary: 500,
    jobType: 'Short-term', deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    category: category._id, jobPoster: employer._id,
  });
  await JobApplication.create({ job: job._id, applicant: worker._id, status: 'Hired' });

  const res = createResponse();
  await getProfile({ user: { id: worker._id.toString() } }, res);

  assert.equal(res.payload.data.jobsApplied, 1);
  assert.equal(res.payload.data.projectsCompleted, 1);
  assert.equal(res.payload.data.successRate, '100%');
  assert.equal(res.payload.data.jobsPosted, undefined, "a pure worker shouldn't get employer fields");
});

test("a 'both'-role user's worker and employer stats never collide on one field", async () => {
  const both = await createUser({ role: 'both' });
  const category = await Category.create({ name: 'Cleaning' });
  const otherWorker = await createUser({ role: 'work' });

  // `both` applies to a job themselves (worker side)...
  const someonesJob = await Job.create({
    title: 'Someone elses job', description: 'x', location: 'QC', salary: 500,
    jobType: 'Short-term', deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    category: category._id, jobPoster: otherWorker._id,
  });
  await JobApplication.create({ job: someonesJob._id, applicant: both._id, status: 'Applied' });

  // ...and also posts their own job (employer side), with no applicants yet.
  await Job.create({
    title: 'Their own job', description: 'x', location: 'QC', salary: 500,
    jobType: 'Short-term', deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    category: category._id, jobPoster: both._id,
  });

  const res = createResponse();
  await getProfile({ user: { id: both._id.toString() } }, res);

  assert.equal(res.payload.data.jobsApplied, 1, 'worker-side stat present');
  assert.equal(res.payload.data.successRate, '0%', 'worker-side rate, not overwritten by employer math');
  assert.equal(res.payload.data.jobsPosted, 1, 'employer-side stat present, on its own field');
  assert.equal(res.payload.data.employerSuccessRate, '0%', 'employer-side rate lives on its own field');
});
