import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { BlobServiceClient } from '@azure/storage-blob';
import express from 'express';
import jwt from 'jsonwebtoken';
import Session from '../../models/Session.js';
import { getJwtSecret } from '../../lib/jwtSecret.js';
import JobApplicationRoute from '../../routes/JobApplicationRoute.js';
import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import User from '../../models/User.js';
import Transaction from '../../models/Transaction.js';
import Category from '../../models/Category.js';
import Message from '../../models/Message.js';
import NotificationOutbox from '../../models/NotificationOutbox.js';
import Notification from '../../models/Notification.js';
import { createJob, updateJob, repostJob } from '../../controllers/JobController.js';
import { createJobOffer, respondToJobOffer, confirmOfferHire } from '../../controllers/JobOfferController.js';
import { submitWork, settleDirect } from '../../controllers/ApplicationPaymentController.js';
import { settleDailyPayment, checkPendingDailyPayments } from '../../services/dailyPayments.js';
import { settleApplicationPayment } from '../../services/applicationSettlement.js';
import { requiredJobFunds, remainingJobFunds } from '../../services/jobFunds.js';
import { requestCancellation, respondCancellation } from '../../services/jobLifecycle.js';
import { getDisputeMoneySnapshot } from '../../services/financialDisputeMoney.js';
import { manilaDate, normalizeWorkDates, DAILY_REVIEW_INTERVAL_MS } from '../../lib/dailyWorkPolicy.js';
import { sendDailyPaymentReminders } from '../../controllers/PaymentReviewReminderController.js';
import { isolateEmailEnvironment } from '../helpers/emailTestEnvironment.js';

isolateEmailEnvironment();

let mongo;
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: 'daily-payments' });
  await Promise.all([Transaction.init(), JobApplication.init(), NotificationOutbox.init()]);
});
beforeEach(async () => { for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({}); });
after(async () => { await mongoose.disconnect(); await mongo?.stop(); });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const person = (role, balance = 0) => User.create({ email: `${new mongoose.Types.ObjectId()}@example.com`, firstName: 'Test', lastName: role, role, status: 'active', employerBalance: balance, workerBalance: 0, companyName: 'Test employer', avatarUrl: '/uploads/test.png', passwordHashed: 'unused' });
const shiftDate = (offset) => manilaDate(new Date(Date.now() + offset * 86400000));
const req = (user, application, body) => ({ params: { applicationId: String(application._id) }, user: { id: String(user._id), role: user.role }, body });
const photo = () => ({ originalname: 'proof.png', mimetype: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]) });
function mockAzure(t) {
  const blobs = new Set();
  const names = ['AZURE_EVIDENCE_CONNECTION_STRING', 'AZURE_EVIDENCE_CONTAINER_NAME'];
  const values = names.map((name) => process.env[name]);
  process.env.AZURE_EVIDENCE_CONNECTION_STRING = 'UseDevelopmentStorage=true'; process.env.AZURE_EVIDENCE_CONTAINER_NAME = 'evidence';
  t.after(() => names.forEach((name, i) => { if (values[i] === undefined) delete process.env[name]; else process.env[name] = values[i]; }));
  t.mock.method(BlobServiceClient, 'fromConnectionString', () => ({ getContainerClient: () => ({ getBlockBlobClient: (name) => ({ uploadData: async () => blobs.add(name), deleteIfExists: async () => ({ succeeded: blobs.delete(name) }) }) }) }));
  return blobs;
}
async function fixture() {
  const [employer, worker] = await Promise.all([person('hire'), person('work')]);
  const workDates = [shiftDate(-1), shiftDate(0)];
  const job = await Job.create({ title: 'Daily work', description: 'Daily tasks', location: 'Pasig', jobType: 'Recruiting', paymentMode: 'daily', workDates, salary: 480, positionsNeeded: 1, hiredCount: 1, jobPoster: employer._id, status: 'In Progress', deadline: new Date(Date.now() + 86400000) });
  const application = await JobApplication.create({ job: job._id, applicant: worker._id, status: 'Hired', workStatus: 'In Progress', startedAt: new Date(), agreedAmount: 960, agreedDailyRate: 480, dailyPayments: workDates.map((workDate) => ({ workDate, amount: 480 })) });
  await Transaction.create({ jobReference: job._id, amount: 960, type: 'ESCROW', status: 'COMPLETED', balanceTarget: 'ESCROW', sender: employer._id, meta: { fundingSources: { EMPLOYER: 960, WORKER: 0 } } });
  return { employer, worker, job, application, workDates };
}
async function submit(f, workDate, extra = {}) {
  const res = response();
  await submitWork({ ...req(f.worker, f.application, { workDate }), files: [photo(), photo()], ...extra }, res);
  return res;
}
const paymentArgs = (f, day) => ({ applicationId: f.application._id, employerId: String(f.employer._id), workDate: day.workDate, expectedSubmittedAt: day.submittedAt });

test('calendar dates use Manila, reject invalid/duplicate/past/single dates and preserve nonconsecutive days', () => {
  assert.equal(DAILY_REVIEW_INTERVAL_MS, 12 * 60 * 60 * 1000);
  assert.equal(manilaDate(new Date('2026-10-19T16:00:00Z')), '2026-10-20');
  const options = { today: '2026-10-19' };
  assert.deepEqual(normalizeWorkDates(['2026-10-22', '2026-10-19'], options), ['2026-10-19', '2026-10-22']);
  for (const dates of [undefined, ['2026-10-19'], ['2026-10-19', '2026-10-19'], ['2026-10-18', '2026-10-20'], ['2026-10-19', '2027-02-30'], ['2026-10-19', {}]]) assert.throws(() => normalizeWorkDates(dates, options), { status: 400 });
});

test('creating and editing daily postings fund rate × days × workers and preserve listing fees', async () => {
  const employer = await person('hire', 5000); const category = await Category.create({ name: 'Daily tasks' });
  const body = { title: 'Daily job', description: 'Daily tasks', location: 'Pasig', salary: 480, jobType: 'Recruiting', workStartTime: '08:00', workEndTime: '17:00', workDates: [shiftDate(0), shiftDate(2)], positionsNeeded: 2, deadline: new Date(Date.now() + 86400000), category: String(category._id) };
  const request = { user: { id: String(employer._id), role: 'hire' }, body };
  const noDates = response(); await createJob({ ...request, body: { ...body, workDates: [] } }, noDates); assert.equal(noDates.statusCode, 400);
  const below = response(); await createJob({ ...request, body: { ...body, salary: 479 } }, below); assert.equal(below.statusCode, 400);
  for (const times of [{ workStartTime: undefined }, { workEndTime: '08:00' }, { workStartTime: '24:00' }]) {
    const invalid = response(); await createJob({ ...request, body: { ...body, ...times } }, invalid); assert.equal(invalid.statusCode, 400);
  }
  const created = response(); await createJob(request, created); assert.equal(created.statusCode, 201);
  const job = await Job.findOne(); assert.equal(job.paymentMode, 'daily');
  assert.equal(job.workStartTime, '08:00'); assert.equal(job.workEndTime, '17:00');
  assert.equal((await remainingJobFunds(job._id)).remaining, 1920);
  assert.equal((await User.findById(employer._id)).employerBalance, 3060);
  const edited = response(); await updateJob({ user: request.user, params: { id: String(job._id) }, body: { workDates: [...body.workDates, shiftDate(4)] } }, edited);
  assert.equal(edited.statusCode, 200); assert.equal((await remainingJobFunds(job._id)).remaining, 2880);
  assert.equal((await User.findById(employer._id)).employerBalance, 2100);
  const editTimes = (body) => updateJob({ user: request.user, params: { id: String(job._id) }, body }, response());
  const overnight = await editTimes({ workStartTime: '22:00', workEndTime: '06:00' });
  assert.equal(overnight.statusCode, 200);
  assert.equal((await Job.findById(job._id)).workEndTime, '06:00');
  assert.equal((await remainingJobFunds(job._id)).remaining, 2880);
  assert.equal((await User.findById(employer._id)).employerBalance, 2100);
  assert.equal((await editTimes({ workEndTime: '22:00' })).statusCode, 400);
  await Job.updateOne({ _id: job._id }, { $set: { reservedOfferCount: 1 } });
  assert.equal((await editTimes({ workStartTime: '21:00' })).statusCode, 409);
  assert.equal((await Job.findById(job._id)).workStartTime, '22:00');
});

test('reposting a legacy long-term job accepts newly selected dates and work times', async () => {
  const employer = await person('hire', 2000); const category = await Category.create({ name: 'Daily tasks' });
  const original = await Job.create({ title: 'Legacy daily work', description: 'Daily tasks', location: 'Pasig', category: category._id, jobType: 'Recruiting', salary: 480, jobPoster: employer._id, status: 'Closed', deadline: new Date(Date.now() - 86400000) });
  const res = response();
  await repostJob({ user: { id: String(employer._id), role: 'hire' }, params: { id: String(original._id) }, body: { deadline: new Date(Date.now() + 5 * 86400000), workDates: [shiftDate(1), shiftDate(3)], workStartTime: '09:00', workEndTime: '18:00' } }, res);
  assert.equal(res.statusCode, 201);
  const repost = await Job.findOne({ repostOf: original._id });
  assert.equal(repost.workStartTime, '09:00'); assert.equal(repost.workEndTime, '18:00');
  assert.equal((await Job.findById(original._id)).workStartTime, null);
});

test('formal offers treat amount as daily rate, secure every daily increase and snapshot dates at hire', async () => {
  const [employer, worker] = await Promise.all([person('hire', 1000), person('work')]);
  const job = await Job.create({ title: 'Daily work', description: 'Daily tasks', location: 'Pasig', jobType: 'Recruiting', paymentMode: 'daily', workStartTime: '08:00', workEndTime: '17:00', workDates: [shiftDate(0), shiftDate(1)], salary: 480, jobPoster: employer._id, deadline: new Date(Date.now() + 86400000) });
  await Transaction.create({ jobReference: job._id, sender: employer._id, amount: 960, type: 'ESCROW', status: 'COMPLETED' });
  const application = await JobApplication.create({ job: job._id, applicant: worker._id });
  const offered = response(); await createJobOffer(req(employer, application, { amount: 600 }), offered); assert.equal(offered.statusCode, 201);
  const message = await Message.findOne({ 'attachment.type': 'job_offer' });
  assert.equal(message.attachment.workStartTime, '08:00'); assert.equal(message.attachment.workEndTime, '17:00');
  assert.equal((await remainingJobFunds(job._id)).remaining, 1200);
  assert.equal((await User.findById(employer._id)).employerBalance, 760);
  const edit = response(); await updateJob({ user: { id: String(employer._id) }, params: { id: String(job._id) }, body: { workDates: [shiftDate(0), shiftDate(2)] } }, edit); assert.equal(edit.statusCode, 409);
  const accepted = response(); await respondToJobOffer({ user: { id: String(worker._id) }, params: { offerId: offered.body.offer.id }, body: { action: 'accept', policyAcknowledged: true } }, accepted); assert.equal(accepted.statusCode, 200);
  const hired = response(); await confirmOfferHire({ user: { id: String(employer._id) }, params: { offerId: offered.body.offer.id }, body: {} }, hired); assert.equal(hired.statusCode, 200);
  assert.equal(hired.body.application.agreedAmount, 1200); assert.equal(hired.body.application.agreedDailyRate, 600);
  assert.deepEqual(hired.body.application.dailyPayments.map((day) => day.amount), [600, 600]);
});

test('daily proofs go to the same chat with exact work/submission dates; future and foreign dates are rejected', async (t) => {
  const blobs = mockAzure(t); const f = await fixture();
  const foreign = await person('work'); const denied = await submit(f, f.workDates[0], { user: { id: String(foreign._id) } }); assert.equal(denied.statusCode, 403);
  const noDate = await submit(f, undefined); assert.equal(noDate.statusCode, 400);
  const future = await submit(f, shiftDate(1)); assert.equal(future.statusCode, 400);
  const unknown = await submit(f, shiftDate(-2)); assert.equal(unknown.statusCode, 400); assert.equal(blobs.size, 0);
  for (const date of f.workDates) assert.equal((await submit(f, date)).statusCode, 200);
  const notices = await Notification.find({ user: f.employer._id, title: `Proof pictures received for ${f.job.title}` }).sort({ createdAt: 1 });
  assert.equal(notices.length, 2, 'each finished work date immediately notifies the employer');
  for (let i = 0; i < f.workDates.length; i += 1) {
    assert.ok(notices[i].message.includes(f.workDates[i]));
    assert.equal(notices[i].audience, 'employer');
    assert.equal(notices[i].metadata.pictureCount, 2);
    assert.equal(notices[i].metadata.workDate, f.workDates[i]);
    assert.equal(notices[i].link, `/employer/applications?applicationId=${f.application._id}&jobId=${f.job._id}`);
  }
  const messages = await Message.find({ job: f.job._id }).sort({ createdAt: 1 }); assert.equal(messages.length, 2);
  assert.deepEqual(messages.map((message) => message.attachment.workDate), f.workDates);
  for (const message of messages) {
    assert.equal(String(message.receiver), String(f.employer._id)); assert.equal(String(message.sender), String(f.worker._id));
    assert.equal(message.attachment.images.length, 2); assert.ok(message.attachment.submittedAt); assert.equal(message.attachment.dailyAmount, 480);
  }
  assert.equal((await JobApplication.findById(f.application._id)).workStatus, 'In Progress');
});

test('daily proof multipart route accepts workDate and an empty or filled statement together', async (t) => {
  const blobs = mockAzure(t); const f = await fixture();
  const session = await Session.create({ user: f.worker._id });
  const token = jwt.sign({ userId: String(f.worker._id), sessionId: String(session._id) }, getJwtSecret());
  const app = express(); app.use('/api', JobApplicationRoute);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/applications/${f.application._id}/work/submit`;
  const upload = (workDate, statement, extraField = false) => {
    const form = new FormData();
    form.append('statement', statement); form.append('workDate', workDate);
    if (extraField) form.append('unexpected', 'extra text');
    for (let index = 0; index < 2; index++) form.append('evidence', new Blob([photo().buffer], { type: 'image/png' }), 'proof.png');
    return fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  };
  for (const [index, workDate] of f.workDates.entries()) {
    const statement = index ? 'Completed the scheduled tasks.' : '';
    const res = await upload(workDate, statement); const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.application.dailyPayments[index].workDate, workDate);
    assert.ok(body.application.dailyPayments[index].submittedAt);
    assert.equal(body.application.workStatus, 'In Progress');
  }
  assert.equal(blobs.size, 4);
  const messages = await Message.find({ job: f.job._id }).sort({ createdAt: 1 });
  assert.deepEqual(messages.map((message) => message.attachment.workDate), f.workDates);
  assert.equal((await JobApplication.findById(f.application._id)).completionEvidence.length, 4);
  assert.equal((await User.findById(f.worker._id)).workerBalance, 0);
  const rejected = await upload(f.workDates[0], 'Revision', true);
  assert.equal(rejected.status, 400); assert.equal((await rejected.json()).message, 'Submit only the statement and workDate text fields.');
  assert.equal(blobs.size, 4);
});

test('Confirm and Pay requires confirmation, owner and current revision, pays each day once and never completes the job', async (t) => {
  mockAzure(t); const f = await fixture();
  const submitted = await submit(f, f.workDates[0]); const old = submitted.body.application.dailyPayments[0];
  const args = paymentArgs(f, old);
  const denied = response(); await settleDirect(req(f.employer, f.application, { workDate: old.workDate, submittedAt: old.submittedAt }), denied); assert.equal(denied.statusCode, 400);
  await assert.rejects(settleDailyPayment({ ...args, employerId: String(f.worker._id) }), { status: 403 });
  await assert.rejects(settleDailyPayment({ ...args, expectedSubmittedAt: undefined }), { status: 409 });
  await assert.rejects(settleApplicationPayment({ applicationId: f.application._id, employerId: String(f.employer._id) }), /specific work date/);
  const revised = await submit(f, old.workDate); const current = revised.body.application.dailyPayments[0];
  await assert.rejects(settleDailyPayment(args), { status: 409 });
  const results = await Promise.all([settleDailyPayment(paymentArgs(f, current)), settleDailyPayment(paymentArgs(f, current))]);
  const dailyKey = `daily-payout:${f.application._id}:${current.workDate}:worker`;
  const notice = await Notification.findOne({ deliveryKey: dailyKey });
  assert.ok(notice, 'daily payment immediately notifies the worker'); assert.equal(String(notice.user), String(f.worker._id));
  assert.equal(notice.audience, 'worker'); assert.ok(notice.message.includes(current.workDate)); assert.match(notice.message, /PHP 480\.00/);
  assert.equal(await Notification.countDocuments({ deliveryKey: dailyKey }), 1);
  const receipts = await NotificationOutbox.find({ key: { $in: [`payment-receipt:daily-payout:${f.application._id}:${current.workDate}:employer`, `payment-receipt:daily-payout:${f.application._id}:${current.workDate}:worker`] } });
  assert.equal(receipts.length, 2, 'daily payment queues one email receipt for each party');
  assert.deepEqual(receipts.map((item) => item.payload.paymentReceipt.userId).sort(), [String(f.employer._id), String(f.worker._id)].sort());
  assert.equal(results.filter((result) => !result.deduplicated).length, 1);
  assert.equal((await User.findById(f.worker._id)).workerBalance, 480);
  assert.equal((await Job.findById(f.job._id)).status, 'In Progress');
  assert.equal(await requiredJobFunds(await Job.findById(f.job._id)), 480);
  assert.equal((await getDisputeMoneySnapshot({ application: await JobApplication.findById(f.application._id), job: f.job })).remainingAgreedAmount, 480);
  const paidProof = await submit(f, current.workDate); assert.equal(paidProof.statusCode, 409);
  const next = await submit(f, f.workDates[1]); await settleDailyPayment(paymentArgs(f, next.body.application.dailyPayments[1]));
  const application = await JobApplication.findById(f.application._id);
  assert.equal(application.paymentStatus, 'Paid'); assert.equal(application.paidAmount, 960); assert.equal(application.workStatus, 'In Progress'); assert.equal(application.completedAt, null);
  assert.equal((await Job.findById(f.job._id)).status, 'In Progress'); assert.equal((await User.findById(f.worker._id)).workerBalance, 960);
  assert.equal(await Transaction.countDocuments({ type: 'PAYOUT' }), 2);
});

test('cancellation holds daily pay and refunds only the remaining balance after a paid day', async (t) => {
  mockAzure(t); const f = await fixture();
  const first = await submit(f, f.workDates[0]); await settleDailyPayment(paymentArgs(f, first.body.application.dailyPayments[0]));
  const next = await submit(f, f.workDates[1]);
  const cancellation = await requestCancellation({ applicationId: f.application._id, actor: f.worker._id, reason: 'Cannot continue', policyAcknowledged: true, workerPayment: 0 });
  await assert.rejects(settleDailyPayment(paymentArgs(f, next.body.application.dailyPayments[1])), { status: 409 });
  await respondCancellation({ cancellationId: cancellation._id, actor: f.employer._id, action: 'accept' });
  assert.equal((await User.findById(f.worker._id)).workerBalance, 480); assert.equal((await User.findById(f.employer._id)).employerBalance, 480);
  assert.equal((await JobApplication.findById(f.application._id)).paidAmount, 480); assert.equal((await remainingJobFunds(f.job._id)).remaining, 0);
});

test('12-hour review sends repeat-safe reminders for unpaid daily proofs only, without paying', async (t) => {
  mockAzure(t); const f = await fixture(); const submitted = await submit(f, f.workDates[0]);
  const day = submitted.body.application.dailyPayments[0];
  const early = await checkPendingDailyPayments({ now: new Date(day.submittedAt.getTime() + DAILY_REVIEW_INTERVAL_MS - 1) }); assert.equal(early.reminders, 0);
  const now = new Date(day.submittedAt.getTime() + DAILY_REVIEW_INTERVAL_MS);
  await Promise.all([checkPendingDailyPayments({ now }), checkPendingDailyPayments({ now })]);
  assert.equal(await NotificationOutbox.countDocuments({ key: /^daily-review:/ }), 1);
  assert.equal((await User.findById(f.worker._id)).workerBalance, 0); assert.equal((await Job.findById(f.job._id)).status, 'In Progress');
  await checkPendingDailyPayments({ now: new Date(now.getTime() + DAILY_REVIEW_INTERVAL_MS) }); assert.equal(await NotificationOutbox.countDocuments({ key: /^daily-review:/ }), 2);
  await settleDailyPayment(paymentArgs(f, day));
  await checkPendingDailyPayments({ now: new Date(now.getTime() + 5 * DAILY_REVIEW_INTERVAL_MS) }); assert.equal(await NotificationOutbox.countDocuments({ key: /^daily-review:/ }), 2);
});

test('daily reminders stop during a hold and the cron endpoint requires the configured secret', async (t) => {
  mockAzure(t); const f = await fixture(); const submission = await submit(f, f.workDates[0]);
  const now = new Date(submission.body.application.dailyPayments[0].submittedAt.getTime() + DAILY_REVIEW_INTERVAL_MS);
  await JobApplication.updateOne({ _id: f.application._id }, { $set: { disputePending: true } });
  assert.equal((await checkPendingDailyPayments({ now })).reminders, 0);
  assert.equal(await NotificationOutbox.countDocuments({ key: /^daily-review:/ }), 0);
  const previous = process.env.CRON_SECRET;
  t.after(() => { if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous; });
  delete process.env.CRON_SECRET;
  const missing = response(); await sendDailyPaymentReminders({ headers: {} }, missing); assert.equal(missing.statusCode, 503);
  process.env.CRON_SECRET = 'daily-reminder-test-secret';
  const denied = response(); await sendDailyPaymentReminders({ headers: { authorization: 'Bearer incorrect' } }, denied); assert.equal(denied.statusCode, 401);
  const allowed = response(); await sendDailyPaymentReminders({ headers: { authorization: 'Bearer daily-reminder-test-secret' } }, allowed); assert.equal(allowed.statusCode, 200);
  assert.equal((await User.findById(f.worker._id)).workerBalance, 0);
});

test('daily release holds when a separate settlement no longer matches the daily ledger', async (t) => {
  mockAzure(t); const f = await fixture(); const submission = await submit(f, f.workDates[0]);
  await JobApplication.updateOne({ _id: f.application._id }, { $set: { paidAmount: 100, paymentStatus: 'Partially Paid' } });
  await assert.rejects(settleDailyPayment(paymentArgs(f, submission.body.application.dailyPayments[0])), /Finance reconciliation/);
  assert.equal((await User.findById(f.worker._id)).workerBalance, 0);
});
