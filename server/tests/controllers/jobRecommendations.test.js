import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import User from '../../models/User.js';
import Job from '../../models/Job.js';
import Category from '../../models/Category.js';
import JobApplication from '../../models/JobApplication.js';
import { getRecommendedJobs } from '../../controllers/JobRecommendationController.js';

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

const request = ({ user, query = {} }) => ({ user, query });

const futureDeadline = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const makeJob = async (overrides = {}) =>
  Job.create({
    title: 'Job',
    description: 'A description.',
    location: 'Antipolo, Rizal',
    salary: 500,
    jobType: 'Short-term',
    deadline: futureDeadline(),
    status: 'Available',
    ...overrides,
  });

before(async () => {
  // A replica set rather than a standalone server: the app's own db helper uses
  // one so transactional code paths work, and tests should match it.
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await replicaSet?.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Job.deleteMany({}),
    Category.deleteMany({}),
    JobApplication.deleteMany({}),
  ]);
});

test('recommendations exclude expired jobs, the viewer\'s own posts, and jobs already applied to', async () => {
  const worker = await User.create({
    firstName: 'Wanda',
    lastName: 'Worker',
    email: 'wanda@example.test',
    passwordHashed: 'hashed-password',
    role: 'work',
    // Skills are embedded documents, not bare strings.
    skills: [{ name: 'plumbing' }],
  });
  const employer = await User.create({
    firstName: 'Ernie',
    lastName: 'Employer',
    email: 'ernie@example.test',
    passwordHashed: 'hashed-password',
    role: 'hire',
  });

  const visible = await makeJob({ title: 'Visible job', jobPoster: employer._id });
  const expired = await makeJob({
    title: 'Expired job',
    jobPoster: employer._id,
    deadline: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });
  const ownPost = await makeJob({ title: 'Own job', jobPoster: worker._id });
  const alreadyApplied = await makeJob({ title: 'Applied job', jobPoster: employer._id });
  const unavailable = await makeJob({
    title: 'Closed job',
    jobPoster: employer._id,
    status: 'Closed',
  });

  await JobApplication.create({ job: alreadyApplied._id, applicant: worker._id });

  const res = response();
  await getRecommendedJobs(request({ user: { id: String(worker._id) } }), res);

  assert.equal(res.statusCode, 200);
  const titles = res.payload.map((job) => job.title);
  assert.deepEqual(titles, [visible.title]);
  for (const excluded of [expired, ownPost, alreadyApplied, unavailable]) {
    assert.ok(!titles.includes(excluded.title), `${excluded.title} should not be recommended`);
  }
});

test('an empty profile still returns jobs, but every match scores zero', async () => {
  // This is the behaviour the UI depends on: a blank profile does NOT produce
  // an empty response. The candidate query is profile-independent, so the
  // ranking falls through to recency and every job comes back at 0%. The
  // clients treat an all-zero result as "no real matches yet" and prompt for
  // profile data rather than presenting recent jobs as personalised picks.
  const worker = await User.create({
    firstName: 'Blank',
    lastName: 'Profile',
    email: 'blank@example.test',
    passwordHashed: 'hashed-password',
    role: 'work',
  });
  const employer = await User.create({
    firstName: 'Ernie',
    lastName: 'Employer',
    email: 'ernie2@example.test',
    passwordHashed: 'hashed-password',
    role: 'hire',
  });

  await makeJob({ title: 'One', jobPoster: employer._id });
  await makeJob({ title: 'Two', jobPoster: employer._id });

  const res = response();
  await getRecommendedJobs(request({ user: { id: String(worker._id) } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.length, 2);
  assert.ok(
    res.payload.every((job) => job.match.percentage === 0),
    'a profile with nothing to match on should score every job at zero',
  );
  assert.ok(
    res.payload.every((job) => job.match.level === 'Potential match'),
    'zero percent is the lowest level',
  );
});

test('a matching skill scores above an unrelated job and ranks first', async () => {
  const worker = await User.create({
    firstName: 'Skilled',
    lastName: 'Worker',
    email: 'skilled@example.test',
    passwordHashed: 'hashed-password',
    role: 'work',
    skills: [{ name: 'carpentry' }],
  });
  const employer = await User.create({
    firstName: 'Ernie',
    lastName: 'Employer',
    email: 'ernie3@example.test',
    passwordHashed: 'hashed-password',
    role: 'hire',
  });

  await makeJob({
    title: 'Unrelated',
    description: 'Nothing in common.',
    jobPoster: employer._id,
  });
  await makeJob({
    title: 'Carpentry work',
    description: 'Carpentry needed for a small build.',
    skills: ['carpentry'],
    jobPoster: employer._id,
  });

  const res = response();
  await getRecommendedJobs(request({ user: { id: String(worker._id) } }), res);

  assert.equal(res.payload[0].title, 'Carpentry work');
  assert.ok(
    res.payload[0].match.percentage > res.payload[1].match.percentage,
    'the skill-matched job should outrank the unrelated one',
  );
});

test('limit is clamped rather than trusted', async () => {
  const worker = await User.create({
    firstName: 'Wanda',
    lastName: 'Worker',
    email: 'limit@example.test',
    passwordHashed: 'hashed-password',
    role: 'work',
  });
  const employer = await User.create({
    firstName: 'Ernie',
    lastName: 'Employer',
    email: 'ernie4@example.test',
    passwordHashed: 'hashed-password',
    role: 'hire',
  });

  for (let index = 0; index < 3; index += 1) {
    await makeJob({ title: `Job ${index}`, jobPoster: employer._id });
  }

  const zero = response();
  await getRecommendedJobs(request({ user: { id: String(worker._id) }, query: { limit: '0' } }), zero);
  // 0 is falsy, so it falls back to the default of 12 rather than returning nothing.
  assert.equal(zero.payload.length, 3);

  const huge = response();
  await getRecommendedJobs(request({ user: { id: String(worker._id) }, query: { limit: '999' } }), huge);
  assert.equal(huge.payload.length, 3, 'an oversized limit must not error');

  const one = response();
  await getRecommendedJobs(request({ user: { id: String(worker._id) }, query: { limit: '1' } }), one);
  assert.equal(one.payload.length, 1);
});

test('an unauthenticated request is refused and an unknown user is a 404', async () => {
  const unauthenticated = response();
  await getRecommendedJobs(request({ user: undefined }), unauthenticated);
  assert.equal(unauthenticated.statusCode, 401);

  const missing = response();
  await getRecommendedJobs(
    request({ user: { id: String(new mongoose.Types.ObjectId()) } }),
    missing,
  );
  assert.equal(missing.statusCode, 404);
});
