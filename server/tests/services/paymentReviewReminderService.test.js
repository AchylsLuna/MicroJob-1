import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import User from '../../models/User.js';
import {
  PAYMENT_REVIEW_DEADLINE_MS,
  PAYMENT_REVIEW_REMINDER_DELAY_MS,
  sendDuePaymentReviewReminders,
} from '../../services/paymentReviewReminderService.js';

let mongo;
const makeUser = async (role, email) => {
  const user = new User({ email, firstName: 'Test', lastName: 'User', role, status: 'active' });
  await user.setPassword('Password123!');
  return user.save();
};

before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: 'payment-review-reminders' });
});
beforeEach(async () => mongoose.connection.db.dropDatabase());
after(async () => { await mongoose.disconnect(); await mongo.stop(); });

test('sends one reminder 24 to 72 hours after submission only while payment is pending', async () => {
  const now = new Date('2026-10-13T12:00:00.000Z');
  const submittedAt = new Date(now.getTime() - PAYMENT_REVIEW_REMINDER_DELAY_MS - 60 * 60 * 1000);
  const [employer, eligibleWorker, earlyWorker, overdueWorker, paidWorker] = await Promise.all([
    makeUser('hire', 'reminder-employer@example.com'),
    makeUser('work', 'reminder-eligible@example.com'),
    makeUser('work', 'reminder-early@example.com'),
    makeUser('work', 'reminder-overdue@example.com'),
    makeUser('work', 'reminder-paid@example.com'),
  ]);
  const job = await Job.create({
    title: 'Community cleanup',
    description: 'Cleanup',
    location: 'Pasig',
    salary: 500,
    jobType: 'Short-term',
    deadline: new Date('2027-01-01'),
    jobPoster: employer._id,
  });
  const eligible = await JobApplication.create({
    job: job._id,
    applicant: eligibleWorker._id,
    status: 'Hired',
    workStatus: 'Submitted',
    workSubmittedAt: submittedAt,
  });
  const tooEarly = await JobApplication.create({
    job: job._id,
    applicant: earlyWorker._id,
    status: 'Hired',
    workStatus: 'Submitted',
    workSubmittedAt: new Date(now.getTime() - PAYMENT_REVIEW_REMINDER_DELAY_MS + 60 * 60 * 1000),
  });
  const overdue = await JobApplication.create({
    job: job._id,
    applicant: overdueWorker._id,
    status: 'Hired',
    workStatus: 'Submitted',
    workSubmittedAt: new Date(now.getTime() - PAYMENT_REVIEW_DEADLINE_MS - 1000),
  });
  const paid = await JobApplication.create({
    job: job._id,
    applicant: paidWorker._id,
    status: 'Hired',
    workStatus: 'Submitted',
    paymentStatus: 'Paid',
    workSubmittedAt: submittedAt,
  });

  const sent = [];
  const result = await sendDuePaymentReviewReminders({
    now,
    sendEmail: async (message) => sent.push(message),
  });
  assert.deepEqual(result, { sent: 1, checked: 1 });
  assert.equal(sent[0].application._id.toString(), eligible._id.toString());
  assert.equal(sent[0].employer.email, employer.email);
  assert.equal(sent[0].deadline.getTime(), submittedAt.getTime() + PAYMENT_REVIEW_DEADLINE_MS);
  assert.ok((await JobApplication.findById(eligible._id)).paymentReminderSentAt);
  assert.equal((await JobApplication.findById(tooEarly._id)).paymentReminderSentAt, null);
  assert.equal((await JobApplication.findById(overdue._id)).paymentReminderSentAt, null);
  assert.equal((await JobApplication.findById(paid._id)).paymentReminderSentAt, null);

  const replay = await sendDuePaymentReviewReminders({
    now,
    sendEmail: async () => assert.fail('A sent reminder must not be sent again.'),
  });
  assert.deepEqual(replay, { sent: 0, checked: 0 });
});

test('releases a reminder claim when delivery fails so a later run can retry', async () => {
  const now = new Date('2026-10-13T12:00:00.000Z');
  const submittedAt = new Date(now.getTime() - PAYMENT_REVIEW_REMINDER_DELAY_MS - 60 * 60 * 1000);
  const [employer, worker] = await Promise.all([
    makeUser('hire', 'retry-employer@example.com'),
    makeUser('work', 'retry-worker@example.com'),
  ]);
  const job = await Job.create({
    title: 'Cleanup',
    description: 'Cleanup',
    location: 'Pasig',
    salary: 500,
    jobType: 'Short-term',
    deadline: new Date('2027-01-01'),
    jobPoster: employer._id,
  });
  const application = await JobApplication.create({
    job: job._id,
    applicant: worker._id,
    status: 'Hired',
    workStatus: 'Submitted',
    workSubmittedAt: submittedAt,
  });

  await assert.rejects(
    sendDuePaymentReviewReminders({ now, sendEmail: async () => { throw new Error('mail provider unavailable'); } }),
    /mail provider unavailable/,
  );
  assert.equal((await JobApplication.findById(application._id)).paymentReminderClaimedAt, null);

  const retry = await sendDuePaymentReviewReminders({ now, sendEmail: async () => {} });
  assert.deepEqual(retry, { sent: 1, checked: 1 });
});
