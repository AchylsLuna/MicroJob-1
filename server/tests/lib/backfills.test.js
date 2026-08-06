import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { runDataBackfills } from '../../lib/backfills.js';
import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import Transaction from '../../models/Transaction.js';
import User from '../../models/User.js';
import Session from '../../models/Session.js';

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'microjobs-backfills-test' });
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

test('runDataBackfills canonicalizes application statuses and backfills missing transaction linkage fields idempotently', async () => {
  const user = new User({
    email: 'worker@example.com',
    firstName: 'Worker',
    lastName: 'One',
    role: 'work',
    status: 'active',
  });
  await user.setPassword('Password123!');
  await user.save();

  const job = await Job.create({
    title: 'Painter',
    description: 'Paint a studio apartment.',
    location: 'Manila',
    salary: 2500,
    jobType: 'Freelance',
    deadline: new Date('2026-04-01T00:00:00.000Z'),
    jobPoster: user._id,
  });

  const legacyApplicationId = new mongoose.Types.ObjectId();
  const legacyInterviewApplicationId = new mongoose.Types.ObjectId();
  const topupTransactionId = new mongoose.Types.ObjectId();
  const escrowTransactionId = new mongoose.Types.ObjectId();
  const legacySessionId = new mongoose.Types.ObjectId();

  await Session.collection.insertOne({
    _id: legacySessionId,
    user: user._id,
    token: 'legacy-plaintext-access-token',
    active: true,
    expiresAt: new Date('2027-01-01T00:00:00.000Z'),
  });

  await JobApplication.collection.insertMany([
    {
      _id: legacyApplicationId,
      job: job._id,
      applicant: user._id,
      status: 'Pending',
      interviews: [],
      timeline: [],
      employerHidden: false,
      createdAt: new Date('2026-03-01T08:00:00.000Z'),
      updatedAt: new Date('2026-03-01T08:00:00.000Z'),
      appliedDate: new Date('2026-03-01T08:00:00.000Z'),
    },
    {
      _id: legacyInterviewApplicationId,
      job: job._id,
      applicant: new mongoose.Types.ObjectId(),
      status: 'Interviewed',
      interviews: [],
      timeline: [],
      employerHidden: false,
      createdAt: new Date('2026-03-04T08:00:00.000Z'),
      updatedAt: new Date('2026-03-04T08:00:00.000Z'),
      appliedDate: new Date('2026-03-04T08:00:00.000Z'),
    },
  ]);

  await Transaction.collection.insertMany([
    {
      _id: topupTransactionId,
      receiver: user._id,
      amount: 1500,
      type: 'TOP_UP',
      reference: 'TOPUP-test-worker-123',
      meta: {
        target: 'WORKER',
        source: 'paymongo',
        checkout_id: 'chk_test_123',
      },
      createdAt: new Date('2026-03-02T08:00:00.000Z'),
      updatedAt: new Date('2026-03-02T08:00:00.000Z'),
    },
    {
      _id: escrowTransactionId,
      sender: user._id,
      amount: 800,
      type: 'ESCROW',
      jobReference: job._id,
      reference: 'ESCROW-job-123',
      createdAt: new Date('2026-03-03T08:00:00.000Z'),
      updatedAt: new Date('2026-03-03T08:00:00.000Z'),
    },
  ]);

  await runDataBackfills();

  let application = await JobApplication.findById(legacyApplicationId).lean();
  let interviewApplication = await JobApplication.findById(legacyInterviewApplicationId).lean();
  let topupTransaction = await Transaction.findById(topupTransactionId).lean();
  let escrowTransaction = await Transaction.findById(escrowTransactionId).lean();
  let migratedSession = await Session.collection.findOne({ _id: legacySessionId });

  assert.equal(application.status, 'Applied');
  assert.equal(application.timeline.length, 1);
  assert.equal(application.timeline[0].status, 'Applied');
  assert.equal(application.timeline[0].type, 'status_changed');
  assert.match(application.timeline[0].note, /Applied/);
  assert.equal(interviewApplication.status, 'Interview Scheduled');
  assert.equal(interviewApplication.timeline.length, 1);
  assert.equal(interviewApplication.timeline[0].status, 'Interview Scheduled');

  assert.equal(topupTransaction.status, 'COMPLETED');
  assert.equal(topupTransaction.balanceTarget, 'WORKER');
  assert.equal(topupTransaction.provider, 'paymongo');
  assert.equal(topupTransaction.providerReference, 'chk_test_123');
  assert.equal(topupTransaction.relatedEntityType, null);
  assert.equal(topupTransaction.relatedEntityId, null);

  assert.equal(escrowTransaction.status, 'COMPLETED');
  assert.equal(escrowTransaction.balanceTarget, 'ESCROW');
  assert.equal(escrowTransaction.relatedEntityType, 'job');
  assert.equal(escrowTransaction.relatedEntityId, String(job._id));
  assert.equal(Object.hasOwn(migratedSession, 'token'), false);

  await runDataBackfills();

  application = await JobApplication.findById(legacyApplicationId).lean();
  interviewApplication = await JobApplication.findById(legacyInterviewApplicationId).lean();
  topupTransaction = await Transaction.findById(topupTransactionId).lean();
  escrowTransaction = await Transaction.findById(escrowTransactionId).lean();
  migratedSession = await Session.collection.findOne({ _id: legacySessionId });

  assert.equal(application.status, 'Applied');
  assert.equal(application.timeline.length, 1);
  assert.equal(interviewApplication.status, 'Interview Scheduled');
  assert.equal(interviewApplication.timeline.length, 1);
  assert.equal(topupTransaction.balanceTarget, 'WORKER');
  assert.equal(topupTransaction.providerReference, 'chk_test_123');
  assert.equal(escrowTransaction.relatedEntityType, 'job');
  assert.equal(escrowTransaction.relatedEntityId, String(job._id));
  assert.equal(Object.hasOwn(migratedSession, 'token'), false);
});
