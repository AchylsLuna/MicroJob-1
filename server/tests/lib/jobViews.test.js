import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import Job from '../../models/Job.js';
import JobView from '../../models/JobView.js';
import { recordJobView } from '../../lib/jobViews.js';

let mongoServer;
const posterId = new mongoose.Types.ObjectId();

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'job-views-tests' });
  await JobView.init(); // build the unique index the dedupe relies on
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([Job.deleteMany({}), JobView.deleteMany({})]);
});

const makeJob = async () =>
  Job.create({
    title: 'Test job',
    description: 'A job',
    location: 'Quezon City',
    salary: 500,
    jobType: 'Short-term',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    jobPoster: posterId,
  });

const viewCountOf = async (job) => (await Job.findById(job._id).lean()).viewCount;

test('a first view from a signed-in user increments the count', async () => {
  const job = await makeJob();
  const counted = await recordJobView(job, { viewerId: new mongoose.Types.ObjectId().toString() });
  assert.equal(counted, true);
  assert.equal(await viewCountOf(job), 1);
});

test('the same signed-in user viewing again does not double count', async () => {
  const job = await makeJob();
  const viewerId = new mongoose.Types.ObjectId().toString();
  await recordJobView(job, { viewerId });
  const second = await recordJobView(job, { viewerId });
  assert.equal(second, false, 'a repeat view must not count');
  assert.equal(await viewCountOf(job), 1);
});

test('two different users each count once', async () => {
  const job = await makeJob();
  await recordJobView(job, { viewerId: new mongoose.Types.ObjectId().toString() });
  await recordJobView(job, { viewerId: new mongoose.Types.ObjectId().toString() });
  assert.equal(await viewCountOf(job), 2);
});

test('the job poster viewing their own listing never counts', async () => {
  const job = await makeJob();
  const counted = await recordJobView(job, { viewerId: posterId.toString() });
  assert.equal(counted, false);
  assert.equal(await viewCountOf(job), 0);
});

test('an anonymous refresh from the same ip and agent counts once', async () => {
  const job = await makeJob();
  const visitor = { ip: '203.0.113.9', userAgent: 'Mozilla/5.0' };
  await recordJobView(job, visitor);
  await recordJobView(job, visitor);
  await recordJobView(job, visitor);
  assert.equal(await viewCountOf(job), 1, 'refreshes must not inflate the count');
});

test('different anonymous visitors are counted separately', async () => {
  const job = await makeJob();
  await recordJobView(job, { ip: '203.0.113.9', userAgent: 'Mozilla/5.0' });
  await recordJobView(job, { ip: '198.51.100.4', userAgent: 'Mozilla/5.0' });
  assert.equal(await viewCountOf(job), 2);
});

test('raw ip addresses are never stored', async () => {
  const job = await makeJob();
  await recordJobView(job, { ip: '203.0.113.9', userAgent: 'Mozilla/5.0' });
  const [row] = await JobView.find({}).lean();
  assert.ok(row.dedupeKey.startsWith('a:'));
  assert.ok(!row.dedupeKey.includes('203.0.113.9'), 'the ip must be hashed, not stored');
});

test('concurrent views from one viewer still count once', async () => {
  const job = await makeJob();
  const viewerId = new mongoose.Types.ObjectId().toString();
  await Promise.all(Array.from({ length: 8 }, () => recordJobView(job, { viewerId })));
  assert.equal(await viewCountOf(job), 1, 'the unique index must hold under concurrency');
});

test('views are tracked per job, not globally', async () => {
  const [jobA, jobB] = [await makeJob(), await makeJob()];
  const viewerId = new mongoose.Types.ObjectId().toString();
  await recordJobView(jobA, { viewerId });
  await recordJobView(jobB, { viewerId });
  assert.equal(await viewCountOf(jobA), 1);
  assert.equal(await viewCountOf(jobB), 1);
});
