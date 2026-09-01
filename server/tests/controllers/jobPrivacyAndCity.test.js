import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import Job from '../../models/Job.js';
import User from '../../models/User.js';
import { getApplicantsList, getJobList } from '../../controllers/JobController.js';

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

const createUser = async (overrides) => {
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

const createJob = (jobPoster, location, applicants = []) => Job.create({
  title: `Local job in ${location}`,
  description: 'A local community job.',
  location,
  salary: 1000,
  jobType: 'Freelance',
  deadline: new Date('2027-01-01T00:00:00.000Z'),
  jobPoster,
  applicants,
});

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'job-privacy-city-tests' });
});

beforeEach(async () => mongoose.connection.db.dropDatabase());

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test('discovery is national and never requires a city', async () => {
  const employer = await createUser({ role: 'hire', companyName: 'Local Services' });
  await Promise.all([
    createJob(employer._id, 'Pasig City, Metro Manila'),
    createJob(employer._id, 'Makati City, Metro Manila'),
    createJob(employer._id, 'Cebu City, Cebu'),
  ]);

  const anonymous = createResponse();
  await getJobList({ query: {}, headers: {} }, anonymous);
  assert.equal(anonymous.statusCode, 200, 'a missing city must not gate discovery');
  assert.equal(anonymous.payload.length, 3, 'every city is visible nationally');
  assert.equal(anonymous.payload[0].jobPoster.email, undefined, 'poster credentials stay hidden');
});

test('a requested city ranks first without hiding the rest of the country', async () => {
  const employer = await createUser({ role: 'hire' });
  await Promise.all([
    createJob(employer._id, 'Makati City, Metro Manila'),
    createJob(employer._id, 'Pasig City, Metro Manila'),
    createJob(employer._id, 'Cebu City, Cebu'),
  ]);

  const response = createResponse();
  await getJobList({ query: { city: 'Pasig City' }, headers: {} }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.length, 3, 'ranking must not drop other cities');
  assert.match(response.payload[0].location, /Pasig City/, 'the chosen city leads');
  assert.equal(response.payload[0].proximity, 'city');
  assert.ok(response.payload.slice(1).every((job) => job.proximity !== 'city'));
});

test("a worker's saved city ranks first and overrides a different query city", async () => {
  const [worker, employer] = await Promise.all([
    createUser({ role: 'work', city: 'Pasig City' }),
    createUser({ role: 'hire' }),
  ]);
  await Promise.all([
    createJob(employer._id, 'Makati City, Metro Manila'),
    createJob(employer._id, 'Pasig City, Metro Manila'),
  ]);

  const response = createResponse();
  await getJobList({
    query: { city: 'Makati City' },
    headers: {},
    user: { id: worker._id, role: 'work' },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.length, 2, 'other cities remain reachable');
  assert.match(response.payload[0].location, /Pasig City/, 'the saved city wins over the query city');
  assert.equal(response.payload[0].proximity, 'city');
});

test('a worker with no city set still sees the national list', async () => {
  const [worker, employer] = await Promise.all([
    createUser({ role: 'work' }),
    createUser({ role: 'hire' }),
  ]);
  await Promise.all([
    createJob(employer._id, 'Davao City, Davao del Sur'),
    createJob(employer._id, 'Cebu City, Cebu'),
  ]);

  const response = createResponse();
  await getJobList({ query: {}, headers: {}, user: { id: worker._id, role: 'work' } }, response);

  assert.equal(response.statusCode, 200, 'a worker without a city must not be blocked');
  assert.equal(response.payload.length, 2);
  assert.ok(response.payload.every((job) => job.proximity === 'national'));
});

test('applicant responses expose hiring fields but not credentials or account balances', async () => {
  const [employer, applicant] = await Promise.all([
    createUser({ role: 'hire' }),
    createUser({
      role: 'work',
      city: 'Pasig City',
      phoneNumber: '09171234567',
      workerBalance: 5000,
      verification: { emailVerified: true, identityVerified: true },
    }),
  ]);
  const job = await createJob(employer._id, 'Pasig City', [applicant._id]);

  const response = createResponse();
  await getApplicantsList({
    params: { jobId: job._id },
    user: { id: employer._id, role: 'hire' },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.length, 1);
  assert.equal(response.payload[0].email, applicant.email);
  assert.equal(response.payload[0].passwordHashed, undefined);
  assert.equal(response.payload[0].workerBalance, undefined);
  assert.equal(response.payload[0].employerBalance, undefined);
  assert.equal(response.payload[0].verification, undefined);

  const defaultUserQuery = await User.findById(applicant._id);
  assert.equal(defaultUserQuery.passwordHashed, undefined);
  const authenticationQuery = await User.findById(applicant._id).select('+passwordHashed');
  assert.ok(authenticationQuery.passwordHashed);
});
