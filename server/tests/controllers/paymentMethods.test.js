import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import PaymentMethod from '../../models/PaymentMethod.js';
import User from '../../models/User.js';
import { getPublicProfile, updateProfile } from '../../controllers/UserController.js';
import {
  addPaymentMethod,
  listPaymentMethods,
  removePaymentMethod,
  setDefaultPaymentMethod,
} from '../../controllers/PaymentMethodController.js';

let mongoServer;
const userId = new mongoose.Types.ObjectId();

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

const addCard = async ({ last4, brand = 'Visa' }) => {
  const response = createResponse();
  await addPaymentMethod(
    {
      user: { id: userId, role: 'hire' },
      body: {
        cardholderName: 'Ana Santos',
        brand,
        last4,
        expiryMonth: 12,
        expiryYear: new Date().getFullYear() + 2,
      },
    },
    response
  );
  assert.equal(response.statusCode, 201);
  return response.payload.paymentMethod;
};

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'payment-method-tests' });
  await PaymentMethod.init();
});

beforeEach(async () => {
  await Promise.all([
    PaymentMethod.deleteMany({}),
    User.deleteMany({}),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test('new users start empty and saved methods remain user scoped', async () => {
  const emptyResponse = createResponse();
  await listPaymentMethods({ user: { id: userId, role: 'hire' } }, emptyResponse);
  assert.deepEqual(emptyResponse.payload.paymentMethods, []);

  const first = await addCard({ last4: '4242' });
  const second = await addCard({ last4: '4444', brand: 'Mastercard' });
  assert.equal(first.status, 'default');
  assert.equal(second.status, 'active');

  const otherUserResponse = createResponse();
  await listPaymentMethods(
    { user: { id: new mongoose.Types.ObjectId(), role: 'hire' } },
    otherUserResponse
  );
  assert.deepEqual(otherUserResponse.payload.paymentMethods, []);
});

test('default and remove actions persist and promote a remaining card', async () => {
  const first = await addCard({ last4: '4242' });
  const second = await addCard({ last4: '4444', brand: 'Mastercard' });

  const defaultResponse = createResponse();
  await setDefaultPaymentMethod(
    { user: { id: userId, role: 'hire' }, params: { paymentMethodId: second.id } },
    defaultResponse
  );
  assert.equal(defaultResponse.statusCode, 200);
  assert.equal(
    defaultResponse.payload.paymentMethods.find((method) => method.id === second.id)?.status,
    'default'
  );

  const removeResponse = createResponse();
  await removePaymentMethod(
    { user: { id: userId, role: 'hire' }, params: { paymentMethodId: second.id } },
    removeResponse
  );
  assert.equal(removeResponse.statusCode, 200);
  assert.equal(removeResponse.payload.paymentMethods.length, 1);
  assert.equal(removeResponse.payload.paymentMethods[0].id, first.id);
  assert.equal(removeResponse.payload.paymentMethods[0].status, 'default');
});

test('worker roles cannot access employer payment methods', async () => {
  const response = createResponse();
  await listPaymentMethods({ user: { id: userId, role: 'work' } }, response);
  assert.equal(response.statusCode, 403);
  assert.match(response.payload.message, /Employer access/i);
});

test('employer privacy persists and worker accounts cannot change it', async () => {
  const employer = await User.create({
    email: 'employer-settings@example.com',
    firstName: 'Em',
    lastName: 'Ployer',
    role: 'hire',
    status: 'active',
    passwordHashed: 'not-used',
  });
  const employerResponse = createResponse();
  await updateProfile(
    {
      user: { id: employer._id, role: 'hire' },
      body: { hideHiredCandidates: false },
    },
    employerResponse
  );
  assert.equal(employerResponse.statusCode, 200);
  assert.equal(employerResponse.payload.user.hideHiredCandidates, false);
  assert.equal((await User.findById(employer._id)).hideHiredCandidates, false);

  const worker = await User.create({
    email: 'worker-settings@example.com',
    firstName: 'Work',
    lastName: 'Er',
    role: 'work',
    status: 'active',
    passwordHashed: 'not-used',
  });
  const workerResponse = createResponse();
  await updateProfile(
    {
      user: { id: worker._id, role: 'work' },
      body: { hideHiredCandidates: false },
    },
    workerResponse
  );
  assert.equal(workerResponse.statusCode, 403);
  assert.equal((await User.findById(worker._id)).hideHiredCandidates, true);
});

test('public employer profiles do not expose hidden hiring totals', async () => {
  const employer = await User.create({
    email: 'private-employer@example.com',
    firstName: 'Private',
    lastName: 'Employer',
    role: 'hire',
    status: 'active',
    passwordHashed: 'not-used',
    hideHiredCandidates: true,
  });
  const response = createResponse();
  await getPublicProfile(
    {
      user: { id: employer._id, role: 'work' },
      params: { userId: employer._id },
      query: { viewAs: 'employer' },
    },
    response
  );
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.rating.hidden, true);
  assert.equal(response.payload.rating.completedCount, null);
  assert.equal(response.payload.stats.employer.hires, null);
  assert.equal(response.payload.stats.employer.hiresHidden, true);
});
