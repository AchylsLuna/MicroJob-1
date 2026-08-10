import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import PaymentMethod from '../../models/PaymentMethod.js';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import {
  changePasswordWithOtp,
  getPublicProfile,
  requestPasswordChangeOtp,
  updateProfile,
} from '../../controllers/UserController.js';
import { updateAdminVerification } from '../../controllers/AdminController.js';
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
    Session.deleteMany({}),
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

test('public employer profiles expose verified reviews but not hidden hiring totals', async () => {
  const employer = await User.create({
    email: 'private-employer@example.com',
    firstName: 'Private',
    lastName: 'Employer',
    role: 'hire',
    status: 'active',
    passwordHashed: 'not-used',
    hideHiredCandidates: true,
    address: '42 Private Street',
    barangay: 'Private Barangay',
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
  assert.equal(response.payload.rating.hidden, false);
  assert.equal(response.payload.rating.totalReviews, 0);
  assert.equal(response.payload.stats.employer.hires, null);
  assert.equal(response.payload.stats.employer.hiresHidden, true);
  assert.equal(response.payload.profile.address, undefined);
  assert.equal(response.payload.profile.barangay, undefined);

  const workerViewResponse = createResponse();
  await getPublicProfile(
    {
      user: { id: employer._id, role: 'work' },
      params: { userId: employer._id },
      query: { viewAs: 'worker' },
    },
    workerViewResponse
  );
  assert.equal(workerViewResponse.payload.stats.employer.hires, null);
  assert.equal(workerViewResponse.payload.stats.employer.hiresHidden, true);
});

test('profile updates reject direct email replacement', async () => {
  const worker = await User.create({
    email: 'email-owner@example.com',
    firstName: 'Email',
    lastName: 'Owner',
    role: 'work',
    status: 'active',
    passwordHashed: 'not-used',
  });
  const response = createResponse();
  await updateProfile(
    {
      user: { id: worker._id, role: 'work' },
      body: { email: 'attacker@example.com' },
    },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.payload.message, /verified email-change flow/i);
  assert.equal((await User.findById(worker._id)).email, 'email-owner@example.com');
});

test('profile updates preserve omitted fields, allow intentional clearing, and enforce location order', async () => {
  const worker = await User.create({
    email: 'persistent-profile@example.com',
    firstName: 'Persist',
    lastName: 'Fields',
    role: 'work',
    status: 'active',
    passwordHashed: 'not-used',
    province: 'Davao del Sur',
    city: 'City of Digos',
    barangay: 'Zone 1',
    about: 'Keep this unless explicitly cleared.',
  });

  const partialResponse = createResponse();
  await updateProfile(
    { user: { id: worker._id, role: 'work' }, body: { firstName: 'Updated' } },
    partialResponse,
  );
  assert.equal(partialResponse.statusCode, 200);
  const afterPartial = await User.findById(worker._id);
  assert.equal(afterPartial.firstName, 'Updated');
  assert.equal(afterPartial.about, 'Keep this unless explicitly cleared.');
  assert.equal(afterPartial.province, 'Davao del Sur');
  assert.equal(afterPartial.city, 'City of Digos');
  assert.equal(afterPartial.barangay, 'Zone 1');

  const clearResponse = createResponse();
  await updateProfile(
    { user: { id: worker._id, role: 'work' }, body: { about: '' } },
    clearResponse,
  );
  assert.equal(clearResponse.statusCode, 200);
  assert.equal((await User.findById(worker._id)).about, undefined);

  const invalidLocationResponse = createResponse();
  await updateProfile(
    {
      user: { id: worker._id, role: 'work' },
      body: { province: '', city: 'City of Digos', barangay: 'Zone 1' },
    },
    invalidLocationResponse,
  );
  assert.equal(invalidLocationResponse.statusCode, 400);
  assert.match(invalidLocationResponse.payload.message, /province/i);
});

test('profile updates normalize professional links and reject unsafe protocols', async () => {
  const worker = await User.create({
    email: 'profile-links@example.com',
    firstName: 'Profile',
    lastName: 'Links',
    role: 'work',
    status: 'active',
    passwordHashed: 'not-used',
  });
  const response = createResponse();
  await updateProfile(
    {
      user: { id: worker._id, role: 'work' },
      body: { linkedin: 'linkedin.com/in/profile-links', website: 'portfolio.example.com' },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.user.linkedin, 'https://linkedin.com/in/profile-links');
  assert.equal(response.payload.user.website, 'https://portfolio.example.com/');

  const invalidResponse = createResponse();
  await updateProfile(
    {
      user: { id: worker._id, role: 'work' },
      body: { website: 'javascript:alert(1)' },
    },
    invalidResponse
  );
  assert.equal(invalidResponse.statusCode, 400);
  assert.match(invalidResponse.payload.message, /valid HTTPS URL/i);
});

test('profile updates reject unsupported fields, invalid types, and excessive text', async () => {
  const worker = await User.create({
    email: 'profile-validation@example.com',
    firstName: 'Profile',
    lastName: 'Validation',
    role: 'work',
    status: 'active',
    passwordHashed: 'not-used',
    city: 'Original City',
  });

  for (const [body, expectedMessage] of [
    [{ avatarUrl: '/uploads/forged.png' }, /Unsupported profile field/i],
    [{ city: { value: 'Injected City' } }, /city must be a string/i],
    [{ addressType: 'warehouse' }, /addressType must be home, office, or place/i],
    [{ about: 'x'.repeat(2001) }, /about must be 2000 characters or fewer/i],
  ]) {
    const response = createResponse();
    await updateProfile(
      { user: { id: worker._id, role: 'work' }, body },
      response
    );
    assert.equal(response.statusCode, 400);
    assert.match(response.payload.message, expectedMessage);
  }

  const persisted = await User.findById(worker._id);
  assert.equal(persisted.city, 'Original City');
  assert.equal(persisted.avatarUrl, undefined);
});

test('public worker profiles include professional work history without private contact details', async () => {
  const worker = await User.create({
    email: 'experienced-worker@example.com',
    phoneNumber: '09171234567',
    firstName: 'Experienced',
    lastName: 'Worker',
    role: 'work',
    status: 'active',
    passwordHashed: 'not-used',
    address: 'Private street address',
    barangay: 'Private Barangay',
    jobPosition: 'Math Tutor',
    website: 'https://portfolio.example.com/',
    workExperience: [
      {
        title: 'Math Tutor',
        company: 'Self-employed',
        location: 'Remote',
        startDate: new Date('2024-01-01T00:00:00.000Z'),
        current: true,
        description: 'Tutored secondary-school students.',
      },
    ],
  });
  const response = createResponse();
  await getPublicProfile(
    {
      user: { id: new mongoose.Types.ObjectId(), role: 'hire' },
      params: { userId: worker._id },
      query: { viewAs: 'worker' },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.profile.jobPosition, 'Math Tutor');
  assert.equal(response.payload.profile.website, 'https://portfolio.example.com/');
  assert.equal(response.payload.profile.workExperience.length, 1);
  assert.equal(response.payload.profile.workExperience[0].company, 'Self-employed');
  assert.equal(response.payload.profile.email, undefined);
  assert.equal(response.payload.profile.phoneNumber, undefined);
  assert.equal(response.payload.profile.address, undefined);
  assert.equal(response.payload.profile.barangay, undefined);
});

test('password changes revoke other sessions but preserve the current session', async () => {
  const worker = new User({
    email: 'password-owner@example.com',
    firstName: 'Password',
    lastName: 'Owner',
    role: 'work',
    status: 'active',
    passwordHashed: 'temporary',
  });
  await worker.setPassword('CurrentPass1!');
  await worker.save();

  const [currentSession, otherSession] = await Session.create([
    { user: worker._id, active: true },
    { user: worker._id, active: true },
  ]);
  const otpResponse = createResponse();
  await requestPasswordChangeOtp(
    {
      user: { id: worker._id, sessionId: currentSession._id },
      body: { currentPassword: 'CurrentPass1!' },
    },
    otpResponse
  );
  assert.equal(otpResponse.statusCode, 200);
  assert.match(String(otpResponse.payload.code), /^\d{6}$/);

  const changeResponse = createResponse();
  await changePasswordWithOtp(
    {
      user: { id: worker._id, sessionId: currentSession._id },
      body: {
        currentPassword: 'CurrentPass1!',
        code: otpResponse.payload.code,
        newPassword: 'UpdatedPass2!',
      },
    },
    changeResponse
  );

  assert.equal(changeResponse.statusCode, 200);
  assert.equal((await Session.findById(currentSession._id)).active, true);
  assert.equal((await Session.findById(otherSession._id)).active, false);
  const updatedUser = await User.findById(worker._id).select('+passwordHashed');
  assert.equal(await updatedUser.validatePassword('UpdatedPass2!'), true);
});

test('admins can approve submitted verification documents', async () => {
  const worker = await User.create({
    email: 'verification-owner@example.com',
    firstName: 'Verify',
    lastName: 'Owner',
    role: 'work',
    status: 'active',
    passwordHashed: 'not-used',
    verification: {
      identityVerified: false,
      identityDocument: {
        status: 'in-review',
        documentUrl: '/uploads/verification-test.pdf',
        uploadedAt: new Date(),
      },
    },
  });
  const response = createResponse();
  await updateAdminVerification(
    {
      user: { id: new mongoose.Types.ObjectId(), role: 'admin' },
      params: { userId: worker._id, documentType: 'identity' },
      body: { status: 'complete' },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.verified, true);
  const updated = await User.findById(worker._id);
  assert.equal(updated.verification.identityVerified, true);
  assert.equal(updated.verification.identityDocument.status, 'complete');
  assert.ok(updated.verification.identityDocument.reviewedAt instanceof Date);
});
