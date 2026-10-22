import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Category from '../../models/Category.js';
import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import User from '../../models/User.js';
import '../../models/QrSettlementRequest.js';
import {
  changeJobStatus, getApplicantsList, getAvailableJobs, getJobByCategory,
  getJobDetails, getJobList, getMyJobs,
} from '../../controllers/JobController.js';
import { applyForJob, getEmployerApplications, getUserApplications } from '../../controllers/JobApplicationController.js';
import { getRecommendedJobs } from '../../controllers/JobRecommendationController.js';
import { listSavedJobs, removeSavedJob, saveJob } from '../../controllers/SavedJobController.js';
import MessageController from '../../controllers/MessageController.js';
import { getPublicProfile } from '../../controllers/UserController.js';
import { getUserReviews } from '../../controllers/ReviewController.js';
import { serializePublicJob } from '../../lib/jobDiscovery.js';
import { encodePublicId } from '../../lib/publicId.js';

let mongoServer;
const response = () => ({
  statusCode: 200, payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = JSON.parse(JSON.stringify(payload)); return this; },
});
const request = (user, overrides = {}) => ({
  user: user ? { id: String(user._id), role: user.role, staffRole: user.staffRole } : undefined,
  query: {}, params: {}, body: {}, headers: {}, get: () => '', ...overrides,
});
const fixture = async () => {
  const users = await User.create(['hire', 'work', 'hire'].map((role, index) => ({
    email: `privacy-${index}@example.test`, firstName: 'Privacy', lastName: 'Test',
    passwordHashed: 'test-hash', role, status: 'active', avatarUrl: '/uploads/avatar.png',
    companyName: role === 'hire' ? 'Example Company' : undefined,
  })));
  const [employer, worker, otherEmployer] = users;
  const category = await Category.create({ name: 'Privacy Test' });
  const job = await Job.create({
    title: 'Public opportunity', description: 'Public description', location: 'Pasig City',
    salary: 1000, jobType: 'Short-term', deadline: new Date(Date.now() + 86400000),
    jobPoster: employer._id, category: category._id, applicants: [worker._id],
    selectedApplicant: worker._id, postingFee: 50, highlightFee: 100,
  });
  return { employer, worker, otherEmployer, category, job, publicId: encodePublicId(job._id) };
};
const assertPublicJob = (job, applicantCount = 1) => {
  assert.ok(job._id);
  assert.equal(job.applicantCount, applicantCount);
  for (const field of ['applicants', 'selectedApplicant', 'postingFee', 'highlightFee', 'closedManually', 'reservedOfferCount']) {
    assert.equal(Object.hasOwn(job, field), false, `${field} must stay private`);
  }
  assert.equal(/"[0-9a-f]{24}"/i.test(JSON.stringify(job)), false, 'public job must contain no MongoDB identifiers');
};

before(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri(), { dbName: 'job-public-privacy-tests' });
});
beforeEach(async () => mongoose.connection.db.dropDatabase());
after(async () => { await mongoose.disconnect(); await mongoServer.stop(); });

test('job details show the requesting worker completion state while other hires and guests cannot see it', async () => {
  const { worker, otherEmployer, job, publicId } = await fixture();
  await JobApplication.create({ job: job._id, applicant: worker._id, status: 'Hired', workStatus: 'Completed', paymentStatus: 'Paid' });
  const own = response();
  await getJobDetails(request(worker, { params: { id: publicId } }), own);
  assert.equal(own.statusCode, 200);
  assert.equal(own.payload.applicationStatus, 'Hired');
  assert.equal(own.payload.applicationWorkStatus, 'Completed');
  for (const viewer of [otherEmployer, null]) {
    const res = response();
    await getJobDetails(request(viewer, { params: { id: publicId } }), res);
    assert.equal(res.statusCode, 200);
    assert.ok(!res.payload.applicationWorkStatus);
  }
  await JobApplication.updateOne({ job: job._id, applicant: worker._id }, { $set: { workStatus: 'Submitted' } });
  const pending = response();
  await getJobDetails(request(worker, { params: { id: publicId } }), pending);
  assert.equal(pending.payload.applicationWorkStatus, 'Submitted');
});

test('anonymous discovery and details expose only public fields and opaque identifiers', async () => {
  const { category, job, publicId } = await fixture();
  for (const [handler, req] of [
    [getJobList, request()],
    [getAvailableJobs, request()],
    [getJobByCategory, request(null, { params: { categoryId: encodePublicId(category._id) } })],
    [getJobDetails, request(null, { params: { id: String(job._id) } })],
    [getJobDetails, request(null, { params: { id: publicId } })],
  ]) {
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    const value = Array.isArray(res.payload) ? res.payload[0] : res.payload;
    assertPublicJob(value);
    assert.equal(value._id, publicId);
    assert.equal(value.category._id, encodePublicId(category._id));
    assert.equal(value.applicationStatus, undefined);
  }
});

test('discovery includes in-progress vacancies and excludes full, paused, historical, and expired recruitment', async () => {
  const { employer, category, worker } = await fixture();
  await Promise.all(['Completed', 'Closed'].map((status) => Job.create({
    title: `${status} opportunity`, description: 'This work is unavailable.', location: 'Pasig City',
    salary: 1000, jobType: 'Short-term', deadline: new Date(Date.now() + 86400000),
    jobPoster: employer._id, category: category._id, status,
  })));

  const progress = { title: 'In-progress vacancy', description: 'Recruiting remaining workers.', location: 'Pasig City', salary: 1000, jobType: 'Short-term', deadline: new Date(Date.now() + 86400000), jobPoster: employer._id, category: category._id, status: 'In Progress', positionsNeeded: 3, hiredCount: 1 };
  await Job.create(progress);
  for (const overrides of [{ reservedOfferCount: 2 }, { hiredCount: 3 }, { closedManually: true }, { cancellationPending: true }, { archivedAt: new Date() }, { deadline: new Date(Date.now() - 1000) }]) await Job.create({ ...progress, title: 'Unavailable recruitment', ...overrides });
  for (const [handler, req] of [[getJobList, request()], [getAvailableJobs, request()], [getJobByCategory, request(null, { params: { categoryId: encodePublicId(category._id) } })], [getRecommendedJobs, request(worker)]]) {
    const res = response(); await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload.map((job) => job.title).sort(), ['In-progress vacancy', 'Public opportunity']);
  }
});

test('a worker can search another location or nationwide without changing their home city', async () => {
  const { employer, worker, category } = await fixture();
  worker.city = 'Pasig City';
  await worker.save();
  const cebuJob = await Job.create({
    title: 'Cebu opportunity', description: 'Cebu description', location: 'Lahug, Cebu City, Cebu',
    salary: 1000, jobType: 'Short-term', deadline: new Date(Date.now() + 86400000),
    jobPoster: employer._id, category: category._id,
  });

  const selected = response();
  await getJobList(request(worker, { query: { location: 'cebu' } }), selected);
  assert.equal(selected.statusCode, 200);
  assert.deepEqual(selected.payload.map((job) => job._id), [encodePublicId(cebuJob._id)]);
  assertPublicJob(selected.payload[0], 0);

  const ranked = response();
  await getJobList(request(worker, { query: { city: 'Cebu City' } }), ranked);
  assert.equal(ranked.payload[0]._id, encodePublicId(cebuJob._id));
  assert.equal(ranked.payload[0].proximity, 'city');

  const nationwide = response();
  await getJobList(request(worker, { query: { location: 'nationwide' } }), nationwide);
  assert.equal(nationwide.statusCode, 200);
  assert.equal(nationwide.payload.length, 2);
  assert.ok(nationwide.payload.every((job) => job.proximity === 'national'));

  const literal = response();
  await getJobList(request(worker, { query: { location: 'Cebu.*' } }), literal);
  assert.deepEqual(literal.payload, [], 'location input must be matched as text, not a regular expression');
  assert.equal((await User.findById(worker._id)).city, 'Pasig City');
});

test('the public serializer cannot expose new internal fields added to a job or poster', () => {
  const job = serializePublicJob({
    _id: new mongoose.Types.ObjectId(), title: 'Allowed', applicants: [new mongoose.Types.ObjectId()],
    futurePrivateField: { token: 'private' },
    jobPoster: { _id: new mongoose.Types.ObjectId(), firstName: 'Employer', email: 'private@example.test', futurePrivateField: 'private' },
    category: { _id: new mongoose.Types.ObjectId(), name: 'Allowed', futurePrivateField: 'private' },
  });
  assert.equal(job.futurePrivateField, undefined);
  assert.equal(job.jobPoster.email, undefined);
  assert.equal(job.jobPoster.futurePrivateField, undefined);
  assert.equal(job.category.futurePrivateField, undefined);
  assertPublicJob(job);
});

test('a viewer receives only their own application status and ownership flag', async () => {
  const { employer, worker, otherEmployer, job, publicId } = await fixture();
  await JobApplication.create({ job: job._id, applicant: worker._id, status: 'Applied' });
  for (const [user, expectedStatus, isOwnJob] of [[worker, 'Applied', false], [employer, null, true], [otherEmployer, null, false]]) {
    for (const handler of [getJobList, getJobDetails]) {
      const res = response();
      await handler(request(user, { params: { id: publicId } }), res);
      assert.equal(res.statusCode, 200);
      const value = Array.isArray(res.payload) ? res.payload[0] : res.payload;
      assertPublicJob(value);
      assert.equal(value.applicationStatus, expectedStatus);
      assert.equal(value.isOwnJob, isOwnJob);
    }
  }
});

test('recommendations and saved jobs use the same private-safe public job shape', async () => {
  const { worker, publicId } = await fixture();
  const recommended = response();
  await getRecommendedJobs(request(worker), recommended);
  assert.equal(recommended.statusCode, 200);
  assertPublicJob(recommended.payload[0]);
  const saved = response();
  await saveJob(request(worker, { body: { jobId: publicId } }), saved);
  assert.equal(saved.statusCode, 201);
  assertPublicJob(saved.payload.data.job);
  const list = response();
  await listSavedJobs(request(worker), list);
  assert.equal(list.statusCode, 200);
  assert.equal(list.payload.data[0].job._id, publicId);
  assertPublicJob(list.payload.data[0].job);
  const removed = response();
  await removeSavedJob(request(worker, { params: { jobId: publicId } }), removed);
  assert.equal(removed.statusCode, 200);
});

test('opaque job ids support applying and keep application-list job ids consistent', async () => {
  const { worker, job, publicId } = await fixture();
  job.applicants = [];
  job.selectedApplicant = null;
  await job.save();
  const applied = response();
  await applyForJob(request(worker, { params: { jobId: publicId } }), applied);
  assert.equal(applied.statusCode, 201);
  const list = response();
  await getUserApplications(request(worker), list);
  assert.equal(list.payload[0].job._id, publicId);
  assertPublicJob(list.payload[0].job);
});

test('opaque ids retain job ownership checks and cannot expose another employer applicants', async () => {
  const { employer, worker, otherEmployer, job, publicId } = await fixture();
  await JobApplication.create({ job: job._id, applicant: worker._id, status: 'Applied' });
  const mine = response();
  await getMyJobs(request(employer), mine);
  assert.equal(mine.payload[0]._id, publicId);
  const applicants = response();
  await getApplicantsList(request(otherEmployer, { params: { jobId: publicId } }), applicants);
  assert.equal(applicants.statusCode, 403);
  const filtered = response();
  await getEmployerApplications(request(otherEmployer, { query: { jobId: publicId } }), filtered);
  assert.equal(filtered.statusCode, 403);
  const legacyFilter = response();
  await getEmployerApplications(request(otherEmployer, { query: { jobId: String(job._id) } }), legacyFilter);
  assert.equal(legacyFilter.statusCode, 403);
  const denied = response();
  await changeJobStatus(request(otherEmployer, { params: { id: publicId }, body: { status: 'Closed' } }), denied);
  assert.equal(denied.statusCode, 403);
  const allowed = response();
  await changeJobStatus(request(employer, { params: { id: publicId }, body: { status: 'Closed' } }), allowed);
  assert.equal(allowed.statusCode, 200);
  assert.equal(allowed.payload.job._id, publicId);
});

test('only job-management staff may change jobs they do not own', async () => {
  const { publicId } = await fixture();
  const support = { _id: new mongoose.Types.ObjectId(), role: 'admin', staffRole: 'support_staff' };
  const moderator = { _id: new mongoose.Types.ObjectId(), role: 'admin', staffRole: 'moderator' };

  const denied = response();
  await changeJobStatus(request(support, { params: { id: publicId }, body: { status: 'Closed' } }), denied);
  assert.equal(denied.statusCode, 403);

  const allowed = response();
  await changeJobStatus(request(moderator, { params: { id: publicId }, body: { status: 'Closed' } }), allowed);
  assert.equal(allowed.statusCode, 200);
});

test('opaque employer and job links still resolve profiles, reviews, and job inquiries', async () => {
  const { employer, worker, otherEmployer, publicId } = await fixture();
  const profileId = encodePublicId(employer._id);
  const profile = response();
  await getPublicProfile(request(worker, { params: { userId: profileId }, query: { viewAs: 'employer' } }), profile);
  assert.equal(profile.statusCode, 200);
  const reviews = response();
  await getUserReviews(request(worker, { params: { userId: profileId }, query: { as: 'employer' } }), reviews);
  assert.equal(reviews.statusCode, 200);
  const inquiry = response();
  await MessageController.startJobInquiry(request(worker, { params: { jobId: publicId }, body: { sendInitialMessage: false } }), inquiry);
  assert.equal(inquiry.statusCode, 200);
  const sent = response();
  await MessageController.sendMessage(request(worker, {
    body: { receiverId: profileId, jobId: publicId, content: 'Fixture inquiry' },
  }), sent);
  assert.equal(sent.statusCode, 201, JSON.stringify(sent.payload));
  const messages = response();
  await MessageController.getMessages(request(worker, { query: { otherUserId: profileId, jobId: publicId } }), messages);
  assert.equal(messages.statusCode, 200);
  assert.equal(messages.payload.data.length, 1);
  const unrelated = response();
  await MessageController.sendMessage(request(worker, {
    body: { receiverId: encodePublicId(otherEmployer._id), jobId: publicId, content: 'Fixture inquiry' },
  }), unrelated);
  assert.equal(unrelated.statusCode, 403);
});

test('malformed public ids are rejected without returning internal errors', async () => {
  const res = response();
  await getJobDetails(request(null, { params: { id: 'invalid-id' } }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error, undefined);
});
