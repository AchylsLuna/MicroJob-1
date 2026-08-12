import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import Category from '../../models/Category.js';
import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import JobOffer from '../../models/JobOffer.js';
import Review from '../../models/Review.js';
import User from '../../models/User.js';
import {
  getEmployerApplications,
  getUserApplications,
} from '../../controllers/JobApplicationController.js';
import { deleteCategory, editCategory } from '../../controllers/CategoryController.js';
import { getUserReviews } from '../../controllers/ReviewController.js';

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

const createUser = async (overrides = {}) => {
  const user = new User({
    email: `${new mongoose.Types.ObjectId()}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    role: 'work',
    status: 'active',
    ...overrides,
  });
  await user.setPassword('Password123!');
  return user.save();
};

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'application-category-integrity-tests' });
});

beforeEach(async () => mongoose.connection.db.dropDatabase());

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test('employer applications include applicant match and rating data on the correct endpoint', async () => {
  const category = await Category.create({ name: 'Electrical' });
  const [employer, worker] = await Promise.all([
    createUser({ role: 'hire', companyName: 'Power Services' }),
    createUser({
      role: 'work',
      firstName: 'Alex',
      skills: [{ name: 'Electrical wiring' }],
      city: 'Pasig City',
      preferredCategories: [category._id],
    }),
  ]);
  const job = await Job.create({
    title: 'Electrician',
    description: 'Install electrical wiring.',
    location: 'Pasig City',
    salary: 2500,
    jobType: 'Short-term',
    deadline: new Date('2027-01-01T00:00:00.000Z'),
    category: category._id,
    skills: ['Electrical wiring'],
    requirements: ['Electrical installation experience'],
    jobPoster: employer._id,
  });
  const application = await JobApplication.create({
    job: job._id,
    applicant: worker._id,
    status: 'Hired',
  });
  const offer = await JobOffer.create({
    job: job._id,
    application: application._id,
    employer: employer._id,
    worker: worker._id,
    amount: 2750,
    additionalEscrow: 250,
    status: 'accepted',
    acceptedAt: new Date('2026-08-13T00:00:00.000Z'),
  });
  await Review.create({
    job: job._id,
    application: application._id,
    reviewer: employer._id,
    reviewee: worker._id,
    reviewerRole: 'employer',
    revieweeRole: 'worker',
    rating: 5,
  });

  const employerResponse = createResponse();
  await getEmployerApplications({ user: { id: employer._id }, query: {} }, employerResponse);

  assert.equal(employerResponse.statusCode, 200);
  assert.equal(employerResponse.payload.length, 1);
  assert.ok(employerResponse.payload[0].match.percentage > 0);
  assert.equal(employerResponse.payload[0].applicant.rating.averageRating, 5);
  assert.equal(employerResponse.payload[0].applicant.rating.totalReviews, 1);
  assert.deepEqual(employerResponse.payload[0].offer, {
    id: String(offer._id),
    amount: 2750,
    status: 'accepted',
    createdAt: offer.createdAt,
    acceptedAt: offer.acceptedAt,
  });

  const reviewResponse = createResponse();
  await getUserReviews({
    user: { id: employer._id },
    params: { userId: worker._id },
    query: { as: 'worker', sort: 'helpful', page: '1', limit: '1' },
  }, reviewResponse);
  assert.equal(reviewResponse.statusCode, 200);
  assert.equal(reviewResponse.payload.reviews.length, 1);
  assert.deepEqual(reviewResponse.payload.pagination, {
    page: 1,
    limit: 1,
    total: 1,
    hasMore: false,
  });

  const workerResponse = createResponse();
  await getUserApplications({ user: { id: worker._id }, query: {} }, workerResponse);
  assert.equal(workerResponse.statusCode, 200);
  assert.equal(Object.hasOwn(workerResponse.payload[0], 'match'), false);
});

test('categories referenced by jobs cannot be deleted and an unchanged name can be saved', async () => {
  const [category, unusedCategory, employer] = await Promise.all([
    Category.create({ name: 'Construction' }),
    Category.create({ name: 'Temporary Category' }),
    createUser({ role: 'hire' }),
  ]);
  await Job.create({
    title: 'Construction helper',
    description: 'Assist a construction crew.',
    location: 'Pasig City',
    salary: 1000,
    jobType: 'Side hustle',
    deadline: new Date('2027-01-01T00:00:00.000Z'),
    category: category._id,
    jobPoster: employer._id,
  });

  const blocked = createResponse();
  await deleteCategory({ params: { id: category._id } }, blocked);
  assert.equal(blocked.statusCode, 409);
  assert.ok(await Category.exists({ _id: category._id }));

  const unchanged = createResponse();
  await editCategory({ params: { id: category._id }, body: { name: ' Construction ' } }, unchanged);
  assert.equal(unchanged.statusCode, 200);
  assert.equal(unchanged.payload.category.name, 'Construction');

  const removed = createResponse();
  await deleteCategory({ params: { id: unusedCategory._id } }, removed);
  assert.equal(removed.statusCode, 200);
  assert.equal(await Category.exists({ _id: unusedCategory._id }), null);
});
