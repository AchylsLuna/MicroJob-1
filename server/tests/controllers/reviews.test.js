import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { createReview, reactToReview, replyToReview } from '../../controllers/ReviewController.js';
import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import Review from '../../models/Review.js';
import User from '../../models/User.js';
import { getReviewSummary } from '../../lib/reviewSummary.js';

let mongoServer;

const createResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'microjobs-reviews-test' });
  await Review.init();
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await Review.syncIndexes();
});

const createParticipant = (email, role, firstName) => User.create({
  email,
  firstName,
  lastName: 'User',
  role,
  status: 'active',
  passwordHashed: 'not-used',
});

test('completed hired workers and employers may review each other once', async () => {
  const [employer, worker, stranger] = await Promise.all([
    createParticipant('review-employer@example.com', 'hire', 'Employer'),
    createParticipant('review-worker@example.com', 'work', 'Worker'),
    createParticipant('review-stranger@example.com', 'work', 'Stranger'),
  ]);
  const job = await Job.create({
    title: 'Electrical repair',
    description: 'Repair building wiring.',
    location: 'Quezon City, Metro Manila',
    salary: 2500,
    jobType: 'Freelance',
    deadline: new Date('2027-01-01T00:00:00.000Z'),
    status: 'Completed',
    jobPoster: employer._id,
  });
  const application = await JobApplication.create({
    job: job._id,
    applicant: worker._id,
    status: 'Hired',
    completedAt: new Date(),
  });

  const workerResponse = createResponse();
  await createReview(
    { user: { id: worker._id }, body: { applicationId: application._id, rating: 5, comment: 'Clear scope and prompt payment.' } },
    workerResponse
  );
  assert.equal(workerResponse.statusCode, 201);
  assert.equal(workerResponse.payload.review.revieweeRole, 'employer');

  const replyResponse = createResponse();
  await replyToReview(
    { user: { id: employer._id }, params: { reviewId: workerResponse.payload.review._id }, body: { reply: 'Thank you for the feedback.' } },
    replyResponse
  );
  assert.equal(replyResponse.statusCode, 200);
  assert.equal(replyResponse.payload.review.ownerReply, 'Thank you for the feedback.');

  const unauthorizedReply = createResponse();
  await replyToReview(
    { user: { id: worker._id }, params: { reviewId: workerResponse.payload.review._id }, body: { reply: 'Not allowed.' } },
    unauthorizedReply
  );
  assert.equal(unauthorizedReply.statusCode, 403);

  const likeResponse = createResponse();
  await reactToReview(
    { user: { id: stranger._id }, params: { reviewId: workerResponse.payload.review._id }, body: { reaction: 'like' } },
    likeResponse
  );
  assert.equal(likeResponse.statusCode, 200);
  assert.equal(likeResponse.payload.review.likeCount, 1);
  assert.equal(likeResponse.payload.review.dislikeCount, 0);
  assert.equal(likeResponse.payload.review.viewerReaction, 'like');

  const switchReactionResponse = createResponse();
  await reactToReview(
    { user: { id: stranger._id }, params: { reviewId: workerResponse.payload.review._id }, body: { reaction: 'dislike' } },
    switchReactionResponse
  );
  assert.equal(switchReactionResponse.payload.review.likeCount, 0);
  assert.equal(switchReactionResponse.payload.review.dislikeCount, 1);
  assert.equal(switchReactionResponse.payload.review.viewerReaction, 'dislike');

  const removeReactionResponse = createResponse();
  await reactToReview(
    { user: { id: stranger._id }, params: { reviewId: workerResponse.payload.review._id }, body: { reaction: null } },
    removeReactionResponse
  );
  assert.equal(removeReactionResponse.payload.review.likeCount, 0);
  assert.equal(removeReactionResponse.payload.review.dislikeCount, 0);
  assert.equal(removeReactionResponse.payload.review.viewerReaction, null);

  const duplicateResponse = createResponse();
  await createReview(
    { user: { id: worker._id }, body: { applicationId: application._id, rating: 4 } },
    duplicateResponse
  );
  assert.equal(duplicateResponse.statusCode, 409);

  const employerResponse = createResponse();
  await createReview(
    { user: { id: employer._id }, body: { applicationId: application._id, rating: 5 } },
    employerResponse
  );
  assert.equal(employerResponse.statusCode, 201);
  assert.equal(employerResponse.payload.review.revieweeRole, 'worker');
  assert.equal(employerResponse.payload.review.comment, '');

  const strangerResponse = createResponse();
  await createReview(
    { user: { id: stranger._id }, body: { applicationId: application._id, rating: 1 } },
    strangerResponse
  );
  assert.equal(strangerResponse.statusCode, 403);
  assert.equal(await Review.countDocuments({ application: application._id }), 2);
});

test('rating summaries are calculated from valid reviews with a five-star breakdown', async () => {
  const reviewee = new mongoose.Types.ObjectId();
  const baseReview = {
    job: new mongoose.Types.ObjectId(),
    reviewer: new mongoose.Types.ObjectId(),
    reviewee,
    reviewerRole: 'employer',
    revieweeRole: 'worker',
  };
  await Review.create([
    { ...baseReview, application: new mongoose.Types.ObjectId(), rating: 5 },
    { ...baseReview, application: new mongoose.Types.ObjectId(), rating: 5 },
    { ...baseReview, application: new mongoose.Types.ObjectId(), rating: 4 },
  ]);

  const summary = await getReviewSummary(reviewee, 'worker');
  assert.equal(summary.averageRating, 4.7);
  assert.equal(summary.percentage, 94);
  assert.equal(summary.totalReviews, 3);
  assert.deepEqual(summary.ratingBreakdown, { 5: 2, 4: 1, 3: 0, 2: 0, 1: 0 });
});

test('reviews remain unavailable until a hired job is completed', async () => {
  const [employer, worker] = await Promise.all([
    createParticipant('open-employer@example.com', 'hire', 'Employer'),
    createParticipant('open-worker@example.com', 'work', 'Worker'),
  ]);
  const job = await Job.create({
    title: 'Maintenance technician',
    description: 'Preventive equipment maintenance.',
    location: 'Quezon City, Metro Manila',
    salary: 2500,
    jobType: 'Freelance',
    deadline: new Date('2027-01-01T00:00:00.000Z'),
    status: 'In Progress',
    jobPoster: employer._id,
  });
  const application = await JobApplication.create({ job: job._id, applicant: worker._id, status: 'Hired' });
  const response = createResponse();
  await createReview(
    { user: { id: worker._id }, body: { applicationId: application._id, rating: 5 } },
    response
  );
  assert.equal(response.statusCode, 403);
  assert.equal(await Review.countDocuments({}), 0);
});
