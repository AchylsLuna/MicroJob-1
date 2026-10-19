import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import User from '../../models/User.js';
import FinancialDispute from '../../models/FinancialDispute.js';
import NotificationOutbox from '../../models/NotificationOutbox.js';
import Notification from '../../models/Notification.js';
import { queueWorkerNonpaymentAlerts } from '../../services/workerNonpaymentAlerts.js';
import { deliverQueuedNotification } from '../../services/notificationOutbox.js';
import { HOUR } from '../../lib/lifecyclePolicy.js';
import { runMaintenance } from '../../services/maintenance.js';
import { getNotificationAssignmentId, resolveNotificationDestination, normalizeNotificationItem } from '../../../Mobile/lib/notifications.ts';

const now = new Date('2026-10-19T08:00:00Z');
const cutoff = new Date(now.getTime() - 72 * HOUR);
let mongo;
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: 'worker-nonpayment-alerts' });
  await Promise.all([NotificationOutbox.init(), Notification.init()]);
});
beforeEach(async () => { for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({}); });
after(async () => { await mongoose.disconnect(); await mongo.stop(); });

async function fixture(overrides = {}, jobOverrides = {}) {
  const [employer, worker] = await Promise.all(['hire', 'work'].map((role) => User.create({ email: `${new mongoose.Types.ObjectId()}@example.test`, firstName: 'Test', lastName: role, role, status: 'active', passwordHashed: 'unused' })));
  const job = await Job.create({ title: 'Unpaid assignment', description: 'Work', location: 'Pasig', salary: 500, jobType: 'Short-term', status: 'In Progress', deadline: new Date(now.getTime() + HOUR), jobPoster: employer._id, hiredCount: 1, ...jobOverrides });
  const application = await JobApplication.create({ job: job._id, applicant: worker._id, status: 'Hired', workStatus: 'Submitted', agreedAmount: 500, firstSubmittedAt: cutoff, workSubmittedAt: cutoff, ...overrides });
  return { employer, worker, job, application };
}

test('the 72-hour boundary alerts only the worker, delivers to their feed, and opens the exact assignment', async () => {
  const f = await fixture();
  assert.equal(await queueWorkerNonpaymentAlerts({ now: new Date(now.getTime() - 1) }), 0);
  assert.equal(await queueWorkerNonpaymentAlerts({ now }), 1);
  const key = `nonpayment-eligible:${f.application._id}:assignment`;
  const queued = await NotificationOutbox.findOne({ key });
  assert.equal(queued.payload.userId, String(f.worker._id)); assert.equal(queued.payload.audience, 'worker');
  assert.equal(queued.payload.link, `/worker/applied-jobs?applicationId=${f.application._id}`);
  assert.equal((await JobApplication.findById(f.application._id)).nonpaymentAlertedAt.getTime(), now.getTime());
  assert.equal(await deliverQueuedNotification(key), 1);
  const notice = await Notification.findOne({ deliveryKey: key });
  assert.ok(notice); assert.equal(String(notice.user), String(f.worker._id));
  const mobileItem = normalizeNotificationItem(notice.toObject());
  assert.equal(resolveNotificationDestination(mobileItem), 'applications');
  assert.equal(getNotificationAssignmentId(mobileItem), String(f.application._id));
  assert.equal(await Notification.countDocuments({ user: f.employer._id }), 0);
  assert.equal((await User.findById(f.worker._id)).workerBalance, 0);
});

test('overlapping runs and notification deletion do not create repeat eligibility alerts', async () => {
  const f = await fixture();
  const counts = await Promise.all([queueWorkerNonpaymentAlerts({ now }), queueWorkerNonpaymentAlerts({ now })]);
  assert.equal(counts.reduce((a, b) => a + b, 0), 1);
  const key = `nonpayment-eligible:${f.application._id}:assignment`;
  await deliverQueuedNotification(key); await Notification.deleteMany({});
  assert.equal(await queueWorkerNonpaymentAlerts({ now: new Date(now.getTime() + HOUR) }), 0);
  assert.equal(await NotificationOutbox.countDocuments({ key }), 1);
});

test('paid, processing, refunded, disputed, cancelled, and held assignments are skipped', async () => {
  for (const paymentStatus of ['Paid', 'Processing', 'Refunded', 'Disputed', 'Partially paid']) await fixture({ paymentStatus });
  await fixture({ status: 'Cancelled' }); await fixture({ cancellationPending: true }); await fixture({ disputePending: true });
  await fixture({}, { cancellationPending: true }); await fixture({}, { status: 'Cancelled' });
  await fixture({ firstSubmittedAt: null, workSubmittedAt: null });
  assert.equal(await queueWorkerNonpaymentAlerts({ now }), 0);
  assert.equal(await NotificationOutbox.countDocuments(), 0);
});

test('an active dispute suppresses the alert even if the assignment hold flag is absent', async () => {
  const f = await fixture();
  await FinancialDispute.create({ job: f.job._id, application: f.application._id, worker: f.worker._id, employer: f.employer._id, raisedBy: f.worker._id, subject: 'Unpaid work', amount: 500, reason: 'Unpaid work', kind: 'nonpayment' });
  assert.equal(await queueWorkerNonpaymentAlerts({ now }), 0);
});

test('resubmissions preserve the original eligibility clock and legacy records use their submission timestamp', async () => {
  await fixture({ workSubmittedAt: now, workStatus: 'Changes Requested' });
  await fixture({ firstSubmittedAt: null, workSubmittedAt: cutoff });
  assert.equal(await queueWorkerNonpaymentAlerts({ now }), 2);
});

test('daily work alerts once per eligible unpaid date, including partially paid assignments', async () => {
  const f = await fixture({ workStatus: 'In Progress', agreedAmount: 1920, paymentStatus: 'Partially Paid', dailyPayments: [
    { workDate: '2026-10-14', amount: 480, submittedAt: cutoff },
    { workDate: '2026-10-15', amount: 480, submittedAt: new Date(cutoff.getTime() + 1) },
    { workDate: '2026-10-16', amount: 480, submittedAt: cutoff, paidAt: cutoff },
    { workDate: '2026-10-17', amount: 480 },
  ] }, { jobType: 'Recruiting', paymentMode: 'daily', salary: 480, workDates: ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'] });
  assert.equal(await queueWorkerNonpaymentAlerts({ now }), 1);
  assert.equal(await queueWorkerNonpaymentAlerts({ now: new Date(now.getTime() + 1) }), 1);
  assert.equal(await queueWorkerNonpaymentAlerts({ now: new Date(now.getTime() + HOUR) }), 0);
  const items = await NotificationOutbox.find({ 'payload.userId': String(f.worker._id) });
  assert.deepEqual(items.map((item) => item.payload.metadata.workDate).sort(), ['2026-10-14', '2026-10-15']);
  assert.equal((await JobApplication.findById(f.application._id)).workStatus, 'In Progress');
});

test('assignment notification links reject external links and mismatched record IDs', () => {
  assert.equal(getNotificationAssignmentId({ entityType: 'application' }), undefined);
  const id = '507f1f77bcf86cd799439011';
  assert.equal(getNotificationAssignmentId({ entityType: 'application', entityId: id, link: `https://example.test/worker/applied-jobs?applicationId=${id}` }), undefined);
  assert.equal(getNotificationAssignmentId({ entityType: 'application', entityId: 'another-id', link: `/worker/applied-jobs?applicationId=${id}` }), undefined);
});

test('scheduled lifecycle maintenance creates and delivers the worker alert without changing employer reminders', async (t) => {
  const previous = process.env.AUTOMATIC_WITHDRAWALS_ENABLED;
  process.env.AUTOMATIC_WITHDRAWALS_ENABLED = 'false';
  t.after(() => { if (previous === undefined) delete process.env.AUTOMATIC_WITHDRAWALS_ENABLED; else process.env.AUTOMATIC_WITHDRAWALS_ENABLED = previous; });
  const submittedAt = new Date(Date.now() - 73 * HOUR);
  const f = await fixture({ firstSubmittedAt: submittedAt, workSubmittedAt: submittedAt });
  const result = await runMaintenance();
  assert.equal(result.workerNonpaymentAlerts, 1); assert.equal(result.reminders, 2);
  assert.equal(await Notification.countDocuments({ user: f.worker._id }), 1);
  assert.equal(await Notification.countDocuments({ user: f.employer._id }), 2);
  assert.equal((await runMaintenance()).workerNonpaymentAlerts, 0);
});
