import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
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
  user: user ? { id: String(user._id), role: user.role } : undefined,
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
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'job-public-privacy-tests' });
});
beforeEach(async () => mongoose.connection.db.dropDatabase());
after(async () => { await mongoose.disconnect(); await mongoServer.stop(); });

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
