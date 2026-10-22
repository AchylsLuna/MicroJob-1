import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import axios from 'axios';
import nodemailer from 'nodemailer';
import crypto from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import Session from '../../models/Session.js';
import StoredUpload from '../../models/StoredUpload.js';
import { getJwtSecret } from '../../lib/jwtSecret.js';
import JobApplicationRoute from '../../routes/JobApplicationRoute.js';
import JobRoute from '../../routes/JobRoute.js';
import FinancialDisputeRoute from '../../routes/FinancialDisputeRoute.js';
import { createUploadsRouter } from '../../routes/UploadRoute.js';
import Job from '../../models/Job.js';
import User from '../../models/User.js';
import JobApplication from '../../models/JobApplication.js';
import JobOffer from '../../models/JobOffer.js';
import Transaction from '../../models/Transaction.js';
import PayoutRequest from '../../models/PayoutRequest.js';
import Cancellation from '../../models/Cancellation.js';
import NotificationOutbox from '../../models/NotificationOutbox.js';
import Notification from '../../models/Notification.js';
import FinancialDispute from '../../models/FinancialDispute.js';
import { requestCancellation, respondCancellation } from '../../services/jobLifecycle.js';
import { remainingJobFunds } from '../../services/jobFunds.js';
import { settleApplicationPayment } from '../../services/applicationSettlement.js';
import { previewWithdrawal, confirmWithdrawal, reconcileWithdrawal, dispatchWithdrawal } from '../../services/withdrawals.js';
import { runMaintenance } from '../../services/maintenance.js';
import { previewPayment } from '../../controllers/ApplicationPaymentController.js';
import { getAssignmentLifecycle, startWork, openDispute, addEvidence } from '../../controllers/LifecycleController.js';
import { updateAdminFinancialDispute } from '../../controllers/AdminFinanceDisputeController.js';
import { proposeDisputeSettlement, approveAndProcessDisputeSettlement } from '../../services/financialDisputeSettlement.js';
import { resolvePublicId } from '../../lib/publicId.js';
import { canFileNonpayment, HOUR, availableJobFilter, recruitmentState } from '../../lib/lifecyclePolicy.js';
import { migrateLifecycle } from '../../scripts/migrateLifecycle.js';
import Category from '../../models/Category.js';
import { createJob, deleteJob, reopenJob, getMyJobs, getJobList, changeJobStatus } from '../../controllers/JobController.js';
import { getRecommendedJobs } from '../../controllers/JobRecommendationController.js';
import { createJobOffer, respondToJobOffer, confirmOfferHire } from '../../controllers/JobOfferController.js';
import { updateInterview, applyForJob, getEmployerApplications } from '../../controllers/JobApplicationController.js';
import { updateHireChecklistItem } from '../../controllers/HireChecklistController.js';
import { MongoRateLimitStore } from '../../lib/mongoRateLimitStore.js';
import AuthRateBucket from '../../models/AuthRateBucket.js';
import { transferWebhook } from '../../controllers/WithdrawalController.js';
import { submitWork, settleDirect, authorizePayment } from '../../controllers/ApplicationPaymentController.js';
import { BlobServiceClient } from '@azure/storage-blob';
import Message from '../../models/Message.js';
import { escalateOverdueDisputes } from '../../services/disputeEscalation.js';
import { deliverQueuedNotification, queueNotification, deliverJobPaymentReceipts } from '../../services/notificationOutbox.js';
import { sendPaymentReceiptEmail } from '../../services/paymentReceiptService.js';
import { csvCell, exportLifecycleReport } from '../../controllers/LifecycleReportController.js';
import { isolateEmailEnvironment } from '../helpers/emailTestEnvironment.js';
import { updateAdminPayoutRequest } from '../../controllers/PaymentController.js';
import { markNotificationRead, listNotifications } from '../../controllers/NotificationController.js';

isolateEmailEnvironment();

let mongo;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri(), { dbName: 'lifecycle' }); await Promise.all([Transaction.init(), PayoutRequest.init(), NotificationOutbox.init(), JobApplication.init(), Notification.init(), AuthRateBucket.init()]); });
beforeEach(async () => { for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({}); delete process.env.AUTOMATIC_WITHDRAWALS_ENABLED; });
after(async () => { await mongoose.disconnect(); await mongo.stop(); });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const person = (role, balance = 0) => User.create({ email: `${new mongoose.Types.ObjectId()}@example.com`, firstName: 'Test', lastName: role, role, status: 'active', employerBalance: balance, workerBalance: balance, passwordHashed: 'unused' });
async function fixture(workStatus = 'Not started', positionsNeeded = 1) {
  const [employer, worker] = await Promise.all([person('hire', 1000), person('work')]);
  const job = await Job.create({ title: 'Test work', description: 'Work', location: 'Pasig', salary: 500, jobType: 'Short-term', deadline: new Date(Date.now() + 24 * HOUR), jobPoster: employer._id, positionsNeeded, hiredCount: 1, status: 'In Progress' });
  const application = await JobApplication.create({ job: job._id, applicant: worker._id, status: 'Hired', agreedAmount: 600, workStatus, ...(workStatus !== 'Not started' ? { startedAt: new Date() } : {}) });
  await JobOffer.create({ job: job._id, application: application._id, employer: employer._id, worker: worker._id, amount: 600, additionalEscrow: 100, status: 'hired' });
  await Transaction.create({ sender: employer._id, amount: positionsNeeded * 500 + 100, type: 'ESCROW', status: 'COMPLETED', balanceTarget: 'ESCROW', jobReference: job._id });
  return { employer, worker, job, application };
}
const cancel = (f, extra = {}) => requestCancellation({ applicationId: f.application._id, actor: f.worker._id, reason: 'Cannot attend', policyAcknowledged: true, ...extra });

async function applicationNotificationFixture() {
  const [employer, worker] = await Promise.all([person('hire'), person('work')]);
  await User.updateOne({ _id: worker._id }, { $set: { avatarUrl: '/uploads/worker.png' } });
  const job = await Job.create({ title: 'Garden helper', description: 'Help in the garden', location: 'Pasig', salary: 500, jobType: 'Short-term', deadline: new Date(Date.now() + 24 * HOUR), jobPoster: employer._id });
  return { employer, worker, job, req: { user: { id: String(worker._id) }, params: { jobId: String(job._id) }, body: {} } };
}

test('applying immediately notifies only the employer with the posted job title, without duplicates', async () => {
  const f = await applicationNotificationFixture();
  const res = response();
  await applyForJob(f.req, res);
  assert.equal(res.statusCode, 201);
  const application = await JobApplication.findOne({ job: f.job._id, applicant: f.worker._id });
  const key = `application-received:${application._id}`;
  const notification = await Notification.findOne({ deliveryKey: key });
  assert.ok(notification);
  assert.equal(String(notification.user), String(f.employer._id));
  assert.equal(notification.audience, 'employer');
  assert.equal(notification.type, 'application');
  assert.equal(notification.title, 'New application for Garden helper');
  assert.match(notification.message, /applied for your job posting "Garden helper"/);
  assert.equal(notification.entityId, String(application._id));
  assert.equal(String(notification.actor), String(f.worker._id));
  assert.equal(notification.metadata.jobTitle, f.job.title);
  assert.equal(notification.readAt, null);
  assert.equal((await NotificationOutbox.findOne({ key })).status, 'delivered');
  const duplicate = response();
  await applyForJob(f.req, duplicate);
  assert.equal(duplicate.statusCode, 400);
  await deliverQueuedNotification(key);
  assert.equal(await Notification.countDocuments({}), 1);
});

test('application notification delivery failure preserves the application and can be retried once', async (t) => {
  const f = await applicationNotificationFixture();
  const failing = t.mock.method(Notification, 'findOneAndUpdate', async () => { throw new Error('Notification service interrupted'); });
  const res = response();
  await applyForJob(f.req, res);
  assert.equal(res.statusCode, 201);
  const application = await JobApplication.findOne({ job: f.job._id, applicant: f.worker._id });
  assert.ok(application);
  const key = `application-received:${application._id}`;
  assert.equal((await NotificationOutbox.findOne({ key })).status, 'pending');
  failing.mock.restore();
  await NotificationOutbox.updateOne({ key }, { $set: { availableAt: new Date(0) } });
  await deliverQueuedNotification(key);
  await deliverQueuedNotification(key);
  assert.equal(await Notification.countDocuments({ deliveryKey: key, user: f.employer._id }), 1);
});

test('assignment details returns the description and assigned checklist only to its participants', async () => {
  const f = await fixture('In Progress', 2);
  const otherWorker = await person('work');
  await JobApplication.create({ job: f.job._id, applicant: otherWorker._id, status: 'Hired', hireChecklist: [{ description: 'Paint the fence' }] });
  await Job.updateOne({ _id: f.job._id }, { $set: { description: 'Clean the grounds.\nKeep the entrance clear.' } });
  await JobApplication.updateOne({ _id: f.application._id }, { $set: { hireChecklist: [{ description: 'Sweep the path', completed: true }, { description: 'Collect litter', completed: false }] } });
  for (const user of [f.worker, f.employer]) {
    const res = response();
    await getAssignmentLifecycle({ params: { applicationId: String(f.application._id) }, user: { id: String(user._id) } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.job.description, 'Clean the grounds.\nKeep the entrance clear.');
    assert.deepEqual(res.body.application.hireChecklist.map((item) => item.description), ['Sweep the path', 'Collect litter']);
  }
  const denied = response();
  await getAssignmentLifecycle({ params: { applicationId: String(f.application._id) }, user: { id: String(otherWorker._id) } }, denied);
  assert.equal(denied.statusCode, 403);
});

test('configurable withdrawal bounds and large employer review reuse Finance without dispatch or duplicate reservation', async () => {
  const names = ['WITHDRAWAL_MIN_AMOUNT', 'WITHDRAWAL_EMPLOYER_MAX_AMOUNT', 'WITHDRAWAL_REVIEW_THRESHOLD'];
  const previous = names.map((name) => process.env[name]);
  try {
    Object.assign(process.env, { WITHDRAWAL_MIN_AMOUNT: '10', WITHDRAWAL_EMPLOYER_MAX_AMOUNT: '90000', WITHDRAWAL_REVIEW_THRESHOLD: '1000' });
    const employer = await person('hire', 80000);
    const body = { sourceWallet: 'EMPLOYER', amount: 60000, destinationSnapshot: { methodType: 'bank_transfer', institutionName: 'Test bank', accountName: 'Employer', accountNumber: '12345678' } };
    await assert.rejects(previewWithdrawal(employer._id, { ...body, amount: 9 }), /at least PHP 10/);
    await assert.rejects(previewWithdrawal(employer._id, { ...body, amount: 90001 }), /maximum/);
    await assert.rejects(previewWithdrawal(employer._id, { ...body, amount: 85000 }), /available wallet balance/);
    const preview = await previewWithdrawal(employer._id, body);
    assert.equal(preview.processingMode, 'manual'); assert.match(preview.reviewReason, /Finance approval/);
    const request = { previewToken: preview.previewToken, detailsConfirmed: true };
    const [first, retry] = await Promise.all([confirmWithdrawal(employer._id, request), confirmWithdrawal(employer._id, request)]);
    assert.equal(String(first._id), String(retry._id)); assert.equal(first.status, 'requested');
    assert.equal(first.policySnapshot.reviewThreshold, 1000);
    assert.equal(first.dispatchStartedAt, undefined);
    assert.equal((await User.findById(employer._id)).employerBalance, 20000);
    assert.equal(await Transaction.countDocuments({ payoutRequest: first._id }), 1);
    // Retrying an already reserved request still works after policy changes.
    process.env.WITHDRAWAL_EMPLOYER_MAX_AMOUNT = '100';
    assert.equal(String((await confirmWithdrawal(employer._id, request))._id), String(first._id));
  } finally { names.forEach((name, index) => { if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index]; }); }
});

test('withdrawal confirmation revalidates policy and rejects another account before reserving funds', async () => {
  const worker = await person('work', 500); const other = await person('work', 500);
  const preview = await previewWithdrawal(worker._id, { amount: 100, destinationSnapshot: { methodType: 'bank_transfer', institutionName: 'Test bank', accountName: 'Worker', accountNumber: '12345678' } });
  const request = { previewToken: preview.previewToken, detailsConfirmed: true };
  await assert.rejects(confirmWithdrawal(other._id, request), /Invalid withdrawal preview/);
  const previous = process.env.WITHDRAWAL_WORKER_MAX_AMOUNT;
  try { process.env.WITHDRAWAL_WORKER_MAX_AMOUNT = '50'; await assert.rejects(confirmWithdrawal(worker._id, request), /maximum/); }
  finally { if (previous === undefined) delete process.env.WITHDRAWAL_WORKER_MAX_AMOUNT; else process.env.WITHDRAWAL_WORKER_MAX_AMOUNT = previous; }
  assert.equal((await User.findById(worker._id)).workerBalance, 500); assert.equal(await PayoutRequest.countDocuments(), 0);
});

test('both wallets require Finance approval and a transfer reference before payment without provider setup', async () => {
  const finance = await person('superadmin');
  for (const [role, sourceWallet] of [['hire', 'EMPLOYER'], ['work', 'WORKER']]) {
    const user = await person(role, 500);
    const preview = await previewWithdrawal(user._id, { sourceWallet, amount: 50, destinationSnapshot: { methodType: 'bank_transfer', institutionName: 'Test e-wallet', accountName: 'Recipient', accountNumber: '09171234567' } });
    assert.equal(preview.requiresReview, true);
    const request = { previewToken: preview.previewToken, detailsConfirmed: true };
    const payout = await confirmWithdrawal(user._id, request);
    assert.equal(payout.status, 'requested');
    assert.equal(payout.processingMode, 'manual');
    assert.equal(payout.dispatchStartedAt, undefined);
    assert.equal(String((await confirmWithdrawal(user._id, request))._id), String(payout._id));
    const field = sourceWallet === 'EMPLOYER' ? 'employerBalance' : 'workerBalance';
    assert.equal((await User.findById(user._id))[field], 450);
    const update = async (body) => {
      const res = response();
      await updateAdminPayoutRequest({ params: { payoutRequestId: String(payout._id) }, user: { id: String(finance._id) }, body }, res);
      return res;
    };
    assert.equal((await update({ status: 'paid', transferReference: 'REF-TEST' })).statusCode, 409);
    assert.equal((await update({ status: 'approved' })).statusCode, 200);
    assert.equal((await Transaction.findById(payout.transaction)).status, 'PENDING');
    assert.equal((await update({ status: 'paid' })).statusCode, 400);
    assert.equal((await update({ status: 'paid', transferReference: 'REF-TEST' })).statusCode, 200);
    assert.equal((await Transaction.findById(payout.transaction)).status, 'COMPLETED');
    assert.equal((await User.findById(user._id))[field], 450);
  }
});

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const photo = () => ({ originalname: 'proof.png', mimetype: 'image/png', buffer: png });
function mockEvidenceAzure(t, { failAt = 0 } = {}) {
  const blobs = new Map();
  let attempts = 0;
  const previous = [process.env.AZURE_EVIDENCE_CONNECTION_STRING, process.env.AZURE_EVIDENCE_CONTAINER_NAME];
  process.env.AZURE_EVIDENCE_CONNECTION_STRING = 'UseDevelopmentStorage=true'; process.env.AZURE_EVIDENCE_CONTAINER_NAME = 'evidence';
  t.after(() => ['AZURE_EVIDENCE_CONNECTION_STRING', 'AZURE_EVIDENCE_CONTAINER_NAME'].forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; }));
  t.mock.method(BlobServiceClient, 'fromConnectionString', () => ({ getContainerClient: () => ({ getBlockBlobClient: (name) => ({
    uploadData: async (buffer, options) => { blobs.set(name, { buffer, contentType: options.blobHTTPHeaders.blobContentType }); if (++attempts === failAt) throw new Error('Simulated interrupted upload'); },
    downloadToBuffer: async () => blobs.get(name)?.buffer,
    getProperties: async () => ({ contentType: blobs.get(name)?.contentType }),
    deleteIfExists: async () => ({ succeeded: blobs.delete(name) }),
  }) }) }));
  return blobs;
}

test('starting work immediately notifies only the employer, refreshes status, and cannot notify twice', async () => {
  const f = await fixture();
  const req = { params: { applicationId: f.application._id }, user: { id: String(f.worker._id) }, body: {} };
  const denied = response();
  await startWork({ ...req, user: { id: String(f.employer._id) } }, denied);
  assert.equal(denied.statusCode, 403);
  assert.equal(await Notification.countDocuments(), 0);
  await queueNotification('unrelated-pending', { userId: String(f.worker._id), title: 'Other event', message: 'Wait for maintenance.' });
  const started = response(); await startWork(req, started);
  assert.equal(started.statusCode, 200);
  assert.equal(started.body.application.workStatus, 'In Progress');
  const key = `work-started:${f.application._id}`;
  const notice = await Notification.findOne({ deliveryKey: key });
  assert.ok(notice, 'employer feed notification exists before the start response returns');
  assert.equal(String(notice.user), String(f.employer._id));
  assert.equal(notice.audience, 'employer');
  assert.equal(notice.title, 'Work in progress');
  assert.match(notice.message, new RegExp(f.job.title));
  assert.equal(notice.metadata.workStatus, 'In Progress');
  assert.equal((await NotificationOutbox.findOne({ key })).status, 'delivered');
  assert.equal((await NotificationOutbox.findOne({ key: 'unrelated-pending' })).status, 'pending');
  const repeated = response(); await startWork(req, repeated);
  assert.equal(repeated.statusCode, 409);
  assert.equal(await Notification.countDocuments({ deliveryKey: key }), 1);
});

test('notification delivery failures preserve started work and remain retryable without duplicate notices', async (t) => {
  const f = await fixture();
  const delivery = t.mock.method(Notification, 'findOneAndUpdate', async () => { throw new Error('Temporary delivery failure'); });
  const started = response();
  await startWork({ params: { applicationId: f.application._id }, user: { id: String(f.worker._id) }, body: {} }, started);
  assert.equal(started.statusCode, 200);
  assert.equal((await JobApplication.findById(f.application._id)).workStatus, 'In Progress');
  const key = `work-started:${f.application._id}`;
  assert.equal((await NotificationOutbox.findOne({ key })).status, 'pending');
  delivery.mock.restore();
  await NotificationOutbox.updateOne({ key }, { $set: { availableAt: new Date(0) } });
  assert.equal(await deliverQueuedNotification(key), 1);
  assert.equal(await deliverQueuedNotification(key), 0);
  assert.equal(await Notification.countDocuments({ deliveryKey: key, user: f.employer._id }), 1);
});

test('completion requires images, rejects text-only/employers, sends chat, and preserves resubmission history', async (t) => {
  const blobs = mockEvidenceAzure(t);
  const f = await fixture('In Progress');
  const req = { params: { applicationId: f.application._id }, user: { id: String(f.worker._id) }, body: {} };
  const missing = response(); await submitWork(req, missing); assert.equal(missing.statusCode, 400);
  const denied = response(); await submitWork({ ...req, user: { id: String(f.employer._id) }, body: { statement: 'Done' } }, denied); assert.equal(denied.statusCode, 403);
  const textOnly = response(); await submitWork({ ...req, body: { statement: 'Done' } }, textOnly); assert.equal(textOnly.statusCode, 400);
  const invalid = response(); await submitWork({ ...req, files: [{ ...photo(), buffer: Buffer.from('fake') }] }, invalid); assert.equal(invalid.statusCode, 400);
  const oversized = response(); await submitWork({ ...req, files: [{ ...photo(), buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }] }, oversized); assert.equal(oversized.statusCode, 413);
  const submitted = response(); await submitWork({ ...req, files: [photo(), photo()], body: { statement: 'Installed the shelves and cleaned the work area.' } }, submitted); assert.equal(submitted.statusCode, 200);
  assert.equal(submitted.body.application.completionEvidence.length, 2);
  const finishedKey = `submit:${f.application._id}:${submitted.body.application.workSubmittedAt.getTime()}`;
  const finished = await Notification.findOne({ deliveryKey: finishedKey });
  assert.ok(finished, 'finished-work notification is delivered without maintenance');
  assert.equal(String(finished.user), String(f.employer._id));
  assert.equal(finished.audience, 'employer');
  assert.equal(finished.title, `Proof pictures received for ${f.job.title}`);
  assert.match(finished.message, /submitted proof/);
  assert.match(finished.message, /2 pictures/);
  assert.equal(finished.link, `/employer/applications?applicationId=${f.application._id}&jobId=${f.job._id}`);
  assert.equal(String(finished.actor), String(f.worker._id));
  assert.equal(finished.metadata.pictureCount, 2);
  assert.equal(finished.readAt, null);
  assert.equal((await NotificationOutbox.findOne({ key: finishedKey })).status, 'delivered');
  assert.equal(blobs.size, 2, 'same-name images have distinct blob names');
  const chat = await Message.findOne({ 'attachment.application': f.application._id });
  assert.equal(String(chat.receiver), String(f.employer._id)); assert.equal(chat.attachment.type, 'completion_evidence'); assert.equal(chat.attachment.images.length, 2);
  const retry = response(); await submitWork({ ...req, files: [photo()], body: { statement: 'Additional proof of completed work.' } }, retry); assert.equal(retry.statusCode, 200);
  assert.equal(retry.body.application.completionEvidence.length, 3);
  assert.equal(retry.body.application.firstSubmittedAt.getTime(), submitted.body.application.firstSubmittedAt.getTime());
  assert.equal(await Notification.countDocuments({ user: f.employer._id }), 2);
  const resubmissionNotice = await Notification.findOne({ deliveryKey: `submit:${f.application._id}:${retry.body.application.workSubmittedAt.getTime()}` });
  assert.match(resubmissionNotice.message, /1 picture for/);
  assert.equal(resubmissionNotice.metadata.pictureCount, 1);
  assert.equal(await Notification.countDocuments({ user: f.worker._id }), 0);
  assert.equal(blobs.size, 3);
  const messages = await Message.find({ 'attachment.application': f.application._id }).sort({ createdAt: 1 });
  assert.equal(messages.length, 2, 'resubmitting appends a proof message without replacing the original');
  assert.equal(messages[0].attachment.images.length, 2);
  assert.equal(messages[1].content, 'Additional proof of completed work.');
  assert.equal(messages[1].attachment.images.length, 1);
  assert.equal(String(messages[1].sender), String(f.worker._id));
  assert.equal(String(messages[1].receiver), String(f.employer._id));
  const oldApproval = response(); await settleDirect({ params: req.params, user: { id: String(f.employer._id) }, body: { confirmed: true, submittedAt: submitted.body.application.workSubmittedAt } }, oldApproval); assert.equal(oldApproval.statusCode, 409);
  await JobApplication.updateOne({ _id: f.application._id }, { $set: { workStatus: 'Changes Requested' } });
  const revised = response(); await submitWork({ ...req, files: [photo()], body: { statement: 'Completed requested adjustments.' } }, revised);
  assert.equal(revised.body.application.completionEvidence.length, 4);
  assert.equal(revised.body.application.firstSubmittedAt.getTime(), submitted.body.application.firstSubmittedAt.getTime());
  assert.equal((await User.findById(f.worker._id)).workerBalance, 0);
  const stale = response(); await settleDirect({ params: req.params, user: { id: String(f.employer._id) }, body: { confirmed: true, submittedAt: '2000-01-01T00:00:00Z' } }, stale); assert.equal(stale.statusCode, 409);
});

test('proof accepts five pictures per submission and rejects six without creating uploads or messages', async (t) => {
  const blobs = mockEvidenceAzure(t);
  const f = await fixture('In Progress');
  const req = { params: { applicationId: f.application._id }, user: { id: String(f.worker._id) }, body: {} };
  const rejected = response();
  await submitWork({ ...req, files: Array.from({ length: 6 }, () => photo()) }, rejected);
  assert.equal(rejected.statusCode, 400);
  assert.equal(blobs.size, 0);
  assert.equal(await Message.countDocuments({ 'attachment.application': f.application._id }), 0);
  const accepted = response();
  await submitWork({ ...req, files: Array.from({ length: 5 }, () => photo()) }, accepted);
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.body.application.completionEvidence.length, 5);
  assert.equal((await Message.findOne({ 'attachment.application': f.application._id })).attachment.images.length, 5);
  assert.equal(blobs.size, 5);
});

test('resubmitting proof cannot bypass payment or cancellation holds and removes uploaded blobs', async (t) => {
  const blobs = mockEvidenceAzure(t);
  const f = await fixture('Submitted');
  const req = { params: { applicationId: f.application._id }, user: { id: String(f.worker._id) }, files: [photo()], body: { statement: 'Another proof' } };
  for (const paymentStatus of ['Paid', 'Processing', 'Disputed', 'Refunded']) {
    await JobApplication.updateOne({ _id: f.application._id }, { $set: { paymentStatus } });
    const res = response(); await submitWork(req, res); assert.equal(res.statusCode, 409);
  }
  await JobApplication.updateOne({ _id: f.application._id }, { $set: { paymentStatus: 'Secured', cancellationPending: true } });
  const held = response(); await submitWork(req, held); assert.equal(held.statusCode, 409);
  assert.equal(blobs.size, 0);
  assert.equal(await Message.countDocuments({ 'attachment.application': f.application._id }), 0);
  assert.equal((await JobApplication.findById(f.application._id)).completionEvidence.length, 0);
});

test('interrupted multi-image Azure upload removes blobs without changing work, sending chat, or releasing funds', async (t) => {
  const blobs = mockEvidenceAzure(t, { failAt: 2 });
  const f = await fixture('In Progress');
  const res = response();
  await submitWork({ params: { applicationId: f.application._id }, user: { id: String(f.worker._id) }, files: [photo(), photo()], body: {} }, res);
  assert.equal(res.statusCode, 503); assert.equal(blobs.size, 0);
  const application = await JobApplication.findById(f.application._id);
  assert.equal(application.workStatus, 'In Progress'); assert.equal(application.completionEvidence.length, 0);
  assert.equal(await Message.countDocuments({ 'attachment.application': f.application._id }), 0);
  assert.equal((await User.findById(f.worker._id)).workerBalance, 0);
});

test('real evidence endpoints require completion images, preserve dispute documents, protect downloads and clean rejected uploads', async (t) => {
  mockEvidenceAzure(t);
  const f = await fixture('In Progress'); const stranger = await person('work');
  const tokenFor = async (user) => { const session = await Session.create({ user: user._id }); return jwt.sign({ userId: String(user._id), sessionId: String(session._id) }, getJwtSecret()); };
  const workerToken = await tokenFor(f.worker); const employerToken = await tokenFor(f.employer); const strangerToken = await tokenFor(stranger);
  const app = express(); app.use(express.json()); app.use('/api', JobApplicationRoute); app.use('/api/financial-disputes', FinancialDisputeRoute); app.use('/uploads', createUploadsRouter());
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const upload = (path, token, contents = '%PDF-1.4\nTest work evidence') => { const form = new FormData(); form.append('evidence', new Blob([contents], { type: 'application/pdf' }), 'proof.pdf'); form.append('statement', 'Work completed with attached evidence.'); return fetch(`${origin}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }); };
  try {
    const completionPath = `/api/applications/${f.application._id}/work/submit`;
    assert.equal((await upload(completionPath, workerToken)).status, 400, 'completion rejects documents');
    for (const [name, type, bytes] of [['proof.gif', 'image/gif', Buffer.from('GIF89a')], ['proof.webp', 'image/webp', Buffer.from('RIFF0000WEBP')]]) {
      const rejectedForm = new FormData(); rejectedForm.append('evidence', new Blob([bytes], { type }), name);
      const rejected = await fetch(`${origin}${completionPath}`, { method: 'POST', headers: { Authorization: `Bearer ${workerToken}` }, body: rejectedForm });
      assert.equal(rejected.status, 400, `completion rejects ${type}`);
      assert.match((await rejected.json()).message, /JPG or PNG/);
    }
    const form = new FormData(); form.append('evidence', new Blob([png], { type: 'image/png' }), 'proof.png'); form.append('evidence', new Blob([png], { type: 'image/png' }), 'proof.png');
    const completion = await fetch(`${origin}${completionPath}`, { method: 'POST', headers: { Authorization: `Bearer ${workerToken}` }, body: form }); assert.equal(completion.status, 200);
    const body = await completion.json(); const url = body.application.completionEvidence[0].fileUrl;
    assert.equal((await fetch(`${origin}${url}`)).status, 401);
    assert.equal((await fetch(`${origin}${url}`, { headers: { Authorization: `Bearer ${strangerToken}` } })).status, 403);
    const downloaded = await fetch(`${origin}${url}`, { headers: { Authorization: `Bearer ${employerToken}` } }); assert.equal(downloaded.status, 200); assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), png);
    assert.equal(downloaded.headers.get('cache-control'), 'private, no-store');
    const opened = response(); await openDispute({ params: { applicationId: f.application._id }, user: { id: String(f.worker._id) }, body: { reason: 'Payment issue' } }, opened);
    const path = `/api/financial-disputes/${opened.body.dispute._id}/evidence`;
    const evidence = await upload(path, workerToken); assert.equal(evidence.status, 201, 'the multipart dispute route must not be shadowed by the legacy statement route');
    assert.ok((await evidence.json()).evidence.fileUrl);
    const legacy = await fetch(`${origin}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${employerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ statement: 'Employer evidence statement', noEvidence: false }) }); assert.equal(legacy.status, 201);
    const count = await StoredUpload.countDocuments();
    assert.equal((await upload(path, strangerToken)).status, 403);
    assert.equal((await upload(path, workerToken, 'not a PDF')).status, 400);
    assert.equal(await StoredUpload.countDocuments(), count);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

function mockReceiptMail(t, sendMail) {
  const names = ['RESEND_API_KEY', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  t.after(() => { for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; } });
  delete process.env.RESEND_API_KEY;
  Object.assign(process.env, { SMTP_HOST: 'mail.example.test', SMTP_PORT: '587', SMTP_USER: 'receipts@example.test', SMTP_PASS: 'test-only', MAIL_FROM: 'receipts@example.test' });
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail }));
}

test('completed job payments email separate receipts to employer and worker once, with private receipt access', async (t) => {
  const sent = []; mockReceiptMail(t, async (mail) => { sent.push(mail); });
  const f = await fixture('Submitted');
  const authorized = response();
  await authorizePayment({ params: { applicationId: f.application._id }, user: { id: String(f.employer._id) }, body: { confirmed: true } }, authorized);
  assert.equal(authorized.statusCode, 200); assert.equal(sent.length, 0, 'authorization is not a completed payment receipt');
  await Promise.all([settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id }), settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id })]);
  assert.equal(sent.length, 2);
  const employerMail = sent.find((mail) => mail.to === f.employer.email);
  const workerMail = sent.find((mail) => mail.to === f.worker.email);
  assert.ok(employerMail); assert.ok(workerMail);
  assert.match(employerMail.text, /Payment Direction: Payment sent/);
  assert.match(workerMail.text, /Payment Direction: Payment received/);
  for (const mail of sent) {
    assert.ok(mail.text.includes(f.job.title)); assert.match(mail.text, /600\.00/);
    assert.match(mail.text, /MJ-PAYOUT-\d{8}-\d{6}/); assert.match(mail.text, /Asia\/Manila/);
    assert.ok(!mail.text.includes(String(f.application._id)));
  }
  const reference = `application-payout:${f.application._id}`;
  assert.equal(await NotificationOutbox.countDocuments({ key: { $in: [`payment-receipt:${reference}:employer`, `payment-receipt:${reference}:worker`] }, status: 'delivered' }), 2);
  await settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id });
  assert.equal(sent.length, 2);
  const transaction = await Transaction.findOne({ reference }); const outsider = await person('work');
  assert.equal((await sendPaymentReceiptEmail({ transactionId: transaction._id, userId: outsider._id })).reason, 'not_found');
  assert.equal(sent.length, 2);
});

test('a failed worker receipt retries independently without resending the employer receipt or reversing payment', async (t) => {
  const f = await fixture('Submitted'); const sent = []; let failWorker = true;
  mockReceiptMail(t, async (mail) => {
    if (mail.to === f.worker.email && failWorker) throw Object.assign(new Error('Private mail-provider details'), { code: 'EAUTH' });
    sent.push(mail);
  });
  await settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id });
  assert.equal(sent.length, 1); assert.equal(sent[0].to, f.employer.email);
  assert.equal((await User.findById(f.worker._id)).workerBalance, 600);
  const reference = `application-payout:${f.application._id}`;
  const key = `payment-receipt:${reference}:worker`;
  const pending = await NotificationOutbox.findOne({ key }); assert.equal(pending.status, 'pending');
  assert.equal(pending.lastError, 'Payment receipt email delivery failed.');
  failWorker = false; await NotificationOutbox.updateOne({ key }, { $set: { availableAt: new Date(0) } });
  await deliverJobPaymentReceipts(reference);
  assert.equal(sent.length, 2); assert.equal(sent.filter((mail) => mail.to === f.employer.email).length, 1);
  assert.equal((await NotificationOutbox.findOne({ key })).status, 'delivered');
  assert.equal((await User.findById(f.worker._id)).workerBalance, 600);
  assert.equal(await Transaction.countDocuments({ reference }), 1);
});

test('confirmed payment authorization immediately notifies only the worker without moving funds or duplicating notices', async () => {
  const f = await fixture('In Progress');
  const req = { params: { applicationId: f.application._id }, user: { id: String(f.employer._id) }, body: { confirmed: true } };
  const denied = response(); await authorizePayment({ ...req, user: { id: String(f.worker._id) } }, denied); assert.equal(denied.statusCode, 403);
  const unconfirmed = response(); await authorizePayment({ ...req, body: {} }, unconfirmed); assert.equal(unconfirmed.statusCode, 400);
  assert.equal(await Notification.countDocuments(), 0);
  const authorized = response(); await authorizePayment(req, authorized); assert.equal(authorized.statusCode, 200);
  assert.equal(authorized.body.application.paymentStatus, 'Authorized');
  const notice = await Notification.findOne({ deliveryKey: `authorize:${f.application._id}:authorized` });
  assert.ok(notice, 'worker feed entry exists before authorization returns');
  assert.equal(String(notice.user), String(f.worker._id)); assert.equal(notice.audience, 'worker');
  assert.equal(notice.title, 'Payment authorized'); assert.ok(notice.message.includes(f.job.title)); assert.match(notice.message, /Funds remain secured/);
  const repeated = response(); await authorizePayment(req, repeated); assert.equal(repeated.statusCode, 200);
  assert.equal(await Notification.countDocuments(), 1);
  assert.equal((await User.findById(f.worker._id)).workerBalance, 0);
  assert.equal(await Transaction.countDocuments({ type: 'PAYOUT' }), 0);
});

test('a failed paid-notification delivery preserves the credit and retries without paying twice', async (t) => {
  const f = await fixture('Submitted');
  const delivery = t.mock.method(Notification, 'findOneAndUpdate', async () => { throw new Error('Temporary notification failure'); });
  const paid = await settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id });
  assert.equal(paid.application.paymentStatus, 'Paid');
  assert.equal((await User.findById(f.worker._id)).workerBalance, 600);
  const key = `job-paid:${f.application._id}`;
  assert.equal((await NotificationOutbox.findOne({ key })).status, 'pending');
  delivery.mock.restore();
  await NotificationOutbox.updateOne({ key }, { $set: { availableAt: new Date(0) } });
  await settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id });
  assert.equal(await Notification.countDocuments({ deliveryKey: key, user: f.worker._id }), 1);
  assert.equal((await User.findById(f.worker._id)).workerBalance, 600);
  assert.equal(await Notification.countDocuments({ user: f.worker._id }), 1);
  assert.equal(await Transaction.countDocuments({ reference: `application-payout:${f.application._id}` }), 1);
});

test('legacy duplicate payment alerts are hidden from feed and unread count, and pending duplicates are retired', async () => {
  const f = await fixture('Submitted');
  await settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id });
  const key = `payment-received:${f.application._id}`;
  const payload = { userId: String(f.worker._id), audience: 'worker', type: 'payment', title: 'Payment received', message: 'Old duplicate', entityType: 'application', entityId: String(f.application._id) };
  await Notification.create({ ...payload, user: f.worker._id, deliveryKey: key });
  await queueNotification(key, payload);
  const feed = response();
  await listNotifications({ user: { id: String(f.worker._id), role: 'work' }, query: { mode: 'worker', limit: '1', unread: 'true' } }, feed);
  assert.equal(feed.statusCode, 200);
  assert.equal(feed.body.notifications.length, 1);
  assert.equal(feed.body.notifications[0].deliveryKey, `job-paid:${f.application._id}`);
  assert.equal(feed.body.unreadCount, 1);
  assert.equal(feed.body.nextCursor, null);
  assert.equal(await deliverQueuedNotification(key), 1);
  assert.equal((await NotificationOutbox.findOne({ key })).status, 'delivered');
  assert.equal((await Notification.findOne({ deliveryKey: key })).pushDeliveredAt, undefined, 'retired entries never send another push');
  assert.equal(await Notification.countDocuments({ deliveryKey: key }), 1);
});

test('payment notifications are never delivered before a caller-owned settlement transaction commits', async () => {
  const f = await fixture('Submitted'); const session = await mongoose.startSession();
  try {
    await assert.rejects(session.withTransaction(async () => {
      await settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id, session });
      assert.equal(await Notification.countDocuments(), 0);
      throw new Error('Abort posting completion');
    }), /Abort posting completion/);
  } finally { await session.endSession(); }
  assert.equal((await User.findById(f.worker._id)).workerBalance, 0);
  assert.equal(await NotificationOutbox.countDocuments({ key: `job-paid:${f.application._id}` }), 0);
  assert.equal(await NotificationOutbox.countDocuments({ key: `payment-received:${f.application._id}` }), 0);
  assert.equal(await NotificationOutbox.countDocuments({ key: { $regex: '^payment-receipt:' } }), 0, 'aborted payments never queue email receipts');
  assert.equal(await Notification.countDocuments(), 0);
});

test('unauthorized and unconfirmed release fail; concurrent confirmed releases credit once and notify both parties', async () => {
  const f = await fixture('Submitted');
  const unauthorized = response(); await settleDirect({ params: { applicationId: f.application._id }, user: { id: String(f.worker._id) }, body: { confirmed: true } }, unauthorized); assert.equal(unauthorized.statusCode, 403);
  const unconfirmed = response(); await settleDirect({ params: { applicationId: f.application._id }, user: { id: String(f.employer._id) }, body: {} }, unconfirmed); assert.equal(unconfirmed.statusCode, 400);
  await Promise.all([settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id }), settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id })]);
  assert.equal((await User.findById(f.worker._id)).workerBalance, 600);
  assert.equal(await Transaction.countDocuments({ reference: `application-payout:${f.application._id}` }), 1);
  assert.equal(await NotificationOutbox.countDocuments({ key: { $in: [`job-paid:${f.application._id}`, `job-paid-employer:${f.application._id}`] } }), 2);
  const notice = await Notification.findOne({ deliveryKey: `job-paid:${f.application._id}` });
  assert.equal(notice.title, `Job marked as done: ${f.job.title}`);
  assert.match(notice.message, /Your employer marked .* as done/);
  assert.equal(String(notice.actor), String(f.employer._id));
  assert.equal(notice.metadata.workStatus, 'Completed');
  assert.equal(notice.readAt, null);
  assert.ok(notice, 'paid worker is notified immediately'); assert.equal(String(notice.user), String(f.worker._id)); assert.equal(notice.audience, 'worker');
  assert.ok(notice.message.includes(f.job.title)); assert.match(notice.message, /PHP 600\.00.*worker balance/);
  assert.equal(await Notification.countDocuments({ deliveryKey: notice.deliveryKey }), 1);
  assert.equal(notice.metadata.amount, 600);
  assert.equal(await Notification.countDocuments({ user: f.worker._id }), 1, 'completion and payment produce one worker alert, including concurrent retries');
});

test('overdue disputes escalate once, preserve evidence deadlines and pending approvals, and never move funds', async () => {
  const f = await fixture('Submitted'); const now = new Date();
  const previous = process.env.FINANCIAL_DISPUTE_REVIEW_HOURS;
  try {
    process.env.FINANCIAL_DISPUTE_REVIEW_HOURS = '24';
    const res = response(); await openDispute({ params: { applicationId: f.application._id }, user: { id: String(f.worker._id) }, body: { reason: 'Payment disputed' } }, res);
    assert.equal(res.statusCode, 201);
    const dispute = res.body.dispute;
    await FinancialDispute.collection.updateOne({ _id: dispute._id }, { $set: { raisedAt: new Date(now.getTime() - 48 * HOUR) } });
    assert.equal(await escalateOverdueDisputes({ now }), 0, 'the evidence window is still open');
    await FinancialDispute.updateOne({ _id: dispute._id }, { $set: { evidenceDueAt: new Date(now.getTime() - HOUR) } });
    const counts = await Promise.all([escalateOverdueDisputes({ now }), escalateOverdueDisputes({ now })]); assert.equal(counts.reduce((a,b) => a+b), 1);
    assert.equal((await FinancialDispute.findById(dispute._id)).investigationStatus, 'ESCALATED');
    await assert.rejects(settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id }), /held/);
    assert.equal((await User.findById(f.worker._id)).workerBalance, 0); assert.equal((await remainingJobFunds(f.job._id)).remaining, 600);
    await FinancialDispute.updateOne({ _id: dispute._id }, { $set: { escalatedAt: null, investigationStatus: 'PENDING_FINANCE_APPROVAL' } });
    assert.equal(await escalateOverdueDisputes({ now }), 1);
    assert.equal((await FinancialDispute.findById(dispute._id)).investigationStatus, 'PENDING_FINANCE_APPROVAL');
  } finally { if (previous === undefined) delete process.env.FINANCIAL_DISPUTE_REVIEW_HOURS; else process.env.FINANCIAL_DISPUTE_REVIEW_HOURS = previous; }
});

async function completeInvestigation(dispute) {
  const support = await person('admin');
  dispute.investigationReport = { status: 'COMPLETED', jobDescription: 'Test work', workCompletionFindings: 'Platform records reviewed', paymentFindings: 'Completed ledger reviewed', timelineSummary: 'Both parties had the evidence opportunity', recommendedFacts: 'Neutral findings', completedAt: new Date(), supportAgent: support._id };
  dispute.investigationStatus = 'FOR_FINANCE_REVIEW';
  await dispute.save();
}
async function financeResolve(dispute, workerPayment) {
  await completeInvestigation(dispute);
  const [finance, approver] = await Promise.all([person('admin'), person('admin')]);
  await proposeDisputeSettlement({ disputeId: dispute._id, financeUserId: finance._id, settlementType: 'PARTIAL_PAYMENT', workerAmount: workerPayment, employerRefund: Math.max(0, Number(dispute.disputedAmount) - workerPayment), decisionReason: 'Reviewed records and the evidence opportunity; allocate the contested funds.' });
  await assert.rejects(approveAndProcessDisputeSettlement({ disputeId: dispute._id, approverId: finance._id }), /different authorized finance/);
  return approveAndProcessDisputeSettlement({ disputeId: dispute._id, approverId: approver._id });
}
test('before-start cancellation preserves history, refunds extra funding once, and reopens the vacancy', async () => {
  const f = await fixture(); const result = await cancel(f);
  assert.equal(result.status, 'resolved');
  assert.equal((await JobApplication.findById(f.application._id)).status, 'Cancelled');
  assert.equal((await User.findById(f.employer._id)).employerBalance, 1100);
  assert.equal((await remainingJobFunds(f.job._id)).remaining, 500);
  assert.equal((await Job.findById(f.job._id)).status, 'Available');
  await assert.rejects(cancel(f)); assert.equal(await Cancellation.countDocuments(), 1);
});
test('started work holds funds until the other party accepts a partial payment', async () => {
  const f = await fixture('In Progress'); const pending = await cancel(f, { workerPayment: 200 });
  assert.equal(pending.status, 'pending');
  await assert.rejects(respondCancellation({ cancellationId: pending._id, actor: f.worker._id, action: 'accept' }), /other party/);
  await respondCancellation({ cancellationId: pending._id, actor: f.employer._id, action: 'accept' });
  assert.equal((await User.findById(f.worker._id)).workerBalance, 200);
  assert.equal((await User.findById(f.employer._id)).employerBalance, 1400);
  assert.equal((await JobApplication.findById(f.application._id)).paymentStatus, 'Partially paid');
  assert.equal((await remainingJobFunds(f.job._id)).remaining, 0);
  await assert.rejects(settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id }));
});
test('whole-post cancellation cancels offers and refunds remaining escrow without deleting records', async () => {
  const f = await fixture('Not started', 2); const other = await person('work');
  const app = await JobApplication.create({ job: f.job._id, applicant: other._id, status: 'Offer Sent' });
  await JobOffer.create({ job: f.job._id, application: app._id, worker: other._id, employer: f.employer._id, amount: 500, status: 'pending' });
  await requestCancellation({ jobId: f.job._id, actor: f.employer._id, reason: 'No longer needed', policyAcknowledged: true });
  assert.equal((await Job.findById(f.job._id)).status, 'Cancelled');
  assert.equal(await JobApplication.countDocuments({ job: f.job._id }), 2);
  assert.equal((await remainingJobFunds(f.job._id)).remaining, 0);
  assert.equal((await User.findById(f.employer._id)).employerBalance, 2100);
  const req = { params: { id: f.job._id }, user: { id: String(f.employer._id) } };
  const reopen = response(); await reopenJob(req, reopen); assert.equal(reopen.statusCode, 409);
  await deleteJob(req, response()); assert.equal(await JobApplication.countDocuments(), 2);
});
test('starting and cancelling concurrently cannot leave started work unilaterally cancelled', async () => {
  const f = await fixture(); const res = response();
  await Promise.allSettled([startWork({ params: { applicationId: f.application._id }, user: { id: String(f.worker._id) } }, res), cancel(f, { workerPayment: 0 })]);
  const app = await JobApplication.findById(f.application._id);
  assert.ok(!(app.startedAt && app.status === 'Cancelled'), 'started work must require agreement');
});
test('an open dispute blocks direct settlement and evidence is participant-only', async () => {
  const f = await fixture('Submitted');
  await JobApplication.updateOne({ _id: f.application._id }, { $set: { firstSubmittedAt: new Date(Date.now() - 73 * HOUR) } });
  const res = response(); await openDispute({ params: { applicationId: f.application._id }, user: { id: String(f.worker._id) }, body: { kind: 'nonpayment', reason: 'Unpaid' } }, res);
  assert.equal(res.statusCode, 201); const dispute = res.body.dispute;
  await assert.rejects(settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id }), /held/);
  const denied = response(); await addEvidence({ params: { id: dispute._id }, user: { id: String(new mongoose.Types.ObjectId()) }, body: { noEvidence: true } }, denied); assert.equal(denied.statusCode, 403);
  for (const user of [f.worker, f.employer]) { const out = response(); await addEvidence({ params: { id: dispute._id }, user: { id: String(user._id) }, body: { noEvidence: true } }, out); assert.equal(out.statusCode, 200); }
  await financeResolve(dispute, 600);
  assert.equal((await User.findById(f.worker._id)).workerBalance, 600);
});
test('reminders deduplicate and nonpayment eligibility uses the first submission', async () => {
  const f = await fixture('Submitted'); const first = new Date(Date.now() - 73 * HOUR);
  await JobApplication.updateOne({ _id: f.application._id }, { $set: { firstSubmittedAt: first, workSubmittedAt: new Date() } });
  assert.equal(canFileNonpayment({ firstSubmittedAt: first }), true);
  assert.equal(canFileNonpayment({ firstSubmittedAt: new Date(Date.now() - 71 * HOUR) }), false);
  await runMaintenance(); await runMaintenance();
  assert.equal(await NotificationOutbox.countDocuments({ key: { $regex: '^payment-reminder:' } }), 2);
});
test('withdrawal preview does not reserve money; confirming the same preview reserves once', async () => {
  const worker = await person('work', 500);
  const preview = await previewWithdrawal(worker._id, { amount: 100, destinationSnapshot: { methodType: 'bank_transfer', institutionName: 'Test bank', accountName: 'Test Worker', accountNumber: '12345678' } });
  assert.equal((await User.findById(worker._id)).workerBalance, 500);
  assert.equal(preview.destination.accountNumber, undefined);
  const [a, b] = await Promise.all([confirmWithdrawal(worker._id, { previewToken: preview.previewToken, detailsConfirmed: true }), confirmWithdrawal(worker._id, { previewToken: preview.previewToken, detailsConfirmed: true })]);
  assert.equal(String(a._id), String(b._id)); assert.equal((await User.findById(worker._id)).workerBalance, 400); assert.equal(await Transaction.countDocuments(), 1);
  await assert.rejects(confirmWithdrawal(worker._id, { previewToken: preview.previewToken, detailsConfirmed: false }));
});
test('legacy automatic employer transfer timeout stays processing; verified failure returns funds exactly once', async () => {
  const employer = await person('hire', 500);
  Object.assign(process.env, { AUTOMATIC_WITHDRAWALS_ENABLED: 'true', PAYMONGO_SECRET_KEY: 'test-key', PAYMONGO_WALLET_ID: 'wallet_test', PAYMONGO_TRANSFER_CALLBACK_URL: 'https://example.com/api/payment/transfers/webhook', PAYMONGO_TRANSFER_WEBHOOK_SECRET: 'test-secret' });
  const get = axios.get; const post = axios.post; let submissions = 0;
  try {
    axios.get = async (url) => {
      if (url.includes('receiving_institutions')) return { data: { data: [{ bic: 'TESTPH', name: 'Test Bank' }] } };
      if (url.includes('/wallets/')) return { data: { data: { source_account: { number: 'source', bic: 'SOURCE', name: 'MicroJobs' } } } };
      const payout = await PayoutRequest.findOne();
      return { data: { data: { id: 'tr_test', status: 'failed', reference_number: `PAYOUT-${payout._id}`, amount: 10000, currency: 'PHP', destination_account: { number: '12345678', bic: 'TESTPH' } } } };
    };
    axios.post = async () => { submissions += 1; throw new Error('timeout'); };
    // Already-reserved automatic transfers still need safe provider reconciliation.
    await User.updateOne({ _id: employer._id }, { $inc: { employerBalance: -100 } });
    const result = await PayoutRequest.create({ user: employer._id, sourceWallet: 'EMPLOYER', processingMode: 'automatic', amount: 100, totalDebit: 100, status: 'processing', destinationSnapshot: { methodType: 'bank_transfer', institutionName: 'Test Bank', bic: 'TESTPH', accountName: 'Employer', accountNumber: '12345678' } });
    await dispatchWithdrawal(result._id);
    assert.equal(result.status, 'processing'); assert.equal((await User.findById(employer._id)).employerBalance, 400);
    await dispatchWithdrawal(result._id); assert.equal(submissions, 1);
    await reconcileWithdrawal(result._id, 'tr_test'); await reconcileWithdrawal(result._id, 'tr_test');
    assert.equal((await User.findById(employer._id)).employerBalance, 500); assert.equal((await User.findById(employer._id)).workerBalance, 500);
    assert.equal(await Transaction.countDocuments({ type: 'REFUND' }), 1);
  } finally { axios.get = get; axios.post = post; }
});
test('dry-run migration preserves all data and does not invent legacy start dates', async () => {
  const f = await fixture('In Progress'); await JobApplication.updateOne({ _id: f.application._id }, { $unset: { startedAt: 1 } });
  const beforeJob = await Job.findById(f.job._id).lean(); const beforeTx = await Transaction.countDocuments();
  const report = await migrateLifecycle(); assert.equal(report.apply, false);
  assert.deepEqual(await Job.findById(f.job._id).lean(), beforeJob); assert.equal(await Transaction.countDocuments(), beforeTx);
  await migrateLifecycle({ apply: true }); const app = await JobApplication.findById(f.application._id); assert.equal(app.startedAt, null); assert.equal(app.workStatus, 'In Progress');
});

test('a consumed vacancy cannot reopen without funding after cancellation', async () => {
  const f = await fixture('In Progress'); const pending = await cancel(f, { workerPayment: 200 });
  await respondCancellation({ cancellationId: pending._id, actor: f.employer._id, action: 'accept' });
  const res = response(); await reopenJob({ params: { id: f.job._id }, user: { id: String(f.employer._id) } }, res);
  assert.equal(res.statusCode, 409); assert.equal((await Job.findById(f.job._id)).status, 'Closed');
});

test('required interview, accepted terms, and employer confirmation precede work', async () => {
  const [employer, worker, other] = await Promise.all([person('hire', 1000), person('work'), person('work')]);
  const job = await Job.create({ title: 'Interviewed work', description: 'Work', location: 'Pasig', salary: 500, jobType: 'Short-term', deadline: new Date(Date.now() + 24 * HOUR), jobPoster: employer._id, interviewRequired: true });
  const app = await JobApplication.create({ job: job._id, applicant: worker._id, interviews: [{ scheduledAt: new Date(Date.now() - HOUR), createdBy: employer._id }] });
  const otherApp = await JobApplication.create({ job: job._id, applicant: other._id });
  await Transaction.create({ sender: employer._id, amount: 500, type: 'ESCROW', status: 'COMPLETED', balanceTarget: 'ESCROW', jobReference: job._id });
  const req = { params: { applicationId: String(app._id) }, user: { id: String(employer._id) }, body: { amount: 500 } };
  const denied = response(); await createJobOffer(req, denied); assert.equal(denied.statusCode, 409);
  const interview = response(); await updateInterview({ ...req, params: { applicationId: String(app._id), interviewId: String(app.interviews[0]._id) }, body: { status: 'completed' } }, interview); assert.equal(interview.statusCode, 200);
  const offered = response(); await createJobOffer(req, offered); assert.equal(offered.statusCode, 201); const offerId = offered.body.offer.id;
  assert.equal((await Job.findById(job._id)).status, 'Closed');
  const accept = { params: { offerId }, user: { id: String(worker._id) }, body: { action: 'accept' } };
  const noTerms = response(); await respondToJobOffer(accept, noTerms); assert.equal(noTerms.statusCode, 400);
  const accepted = response(); await respondToJobOffer({ ...accept, body: { action: 'accept', policyAcknowledged: true } }, accepted); assert.equal(accepted.statusCode, 200);
  const hired = response(); await confirmOfferHire({ params: { offerId }, user: { id: String(employer._id) } }, hired); assert.equal(hired.statusCode, 200);
  assert.equal((await Job.findById(job._id)).status, 'In Progress');
  assert.equal((await JobApplication.findById(app._id)).workStatus, 'Not started');
  assert.equal((await JobApplication.findById(otherApp._id)).status, 'Position filled');
  const started = response(); await startWork({ params: { applicationId: String(app._id) }, user: { id: String(worker._id) } }, started); assert.equal(started.statusCode, 200);
  assert.ok((await JobApplication.findById(app._id)).startedAt);
});

test('in-progress recruitment allows remaining applications and hires while reservations prevent oversubscription', async () => {
  const f = await fixture('Not started', 2); const worker = await person('work'); const backup = await person('work');
  await User.updateMany({ _id: { $in: [worker._id, backup._id] } }, { $set: { avatarUrl: '/uploads/test.png' } });
  const viewer = { user: { id: String(worker._id), role: 'work' }, query: {} };
  const list = response(); await getJobList(viewer, list); assert.equal(list.statusCode, 200); assert.equal(list.body.length, 1); assert.equal(list.body[0].recruitmentOpen, true); assert.equal(list.body[0].availablePositions, 1);
  const recommended = response(); await getRecommendedJobs(viewer, recommended); assert.equal(recommended.body.length, 1);
  const applied = response(); await applyForJob({ ...viewer, params: { jobId: String(f.job._id) }, body: {} }, applied); assert.equal(applied.statusCode, 201);
  const application = await JobApplication.findOne({ job: f.job._id, applicant: worker._id });
  const offerReq = { params: { applicationId: String(application._id) }, user: { id: String(f.employer._id) }, body: { amount: 500 } };
  const offered = response(); await createJobOffer(offerReq, offered); assert.equal(offered.statusCode, 201);
  let job = await Job.findById(f.job._id); assert.equal(job.status, 'In Progress'); assert.equal(recruitmentState(job).recruitmentOpen, false);
  assert.equal(await Job.countDocuments({ _id: job._id, ...availableJobFilter() }), 0);
  const blocked = response(); await applyForJob({ user: { id: String(backup._id) }, params: { jobId: String(job._id) }, body: {} }, blocked); assert.equal(blocked.statusCode, 409);
  const rejected = response(); await respondToJobOffer({ params: { offerId: offered.body.offer.id }, user: { id: String(worker._id) }, body: { action: 'reject' } }, rejected); assert.equal(rejected.statusCode, 200);
  job = await Job.findById(job._id); assert.equal(job.status, 'In Progress'); assert.equal(recruitmentState(job).recruitmentOpen, true);
  const second = response(); await createJobOffer(offerReq, second); assert.equal(second.statusCode, 201);
  const accepted = response(); await respondToJobOffer({ params: { offerId: second.body.offer.id }, user: { id: String(worker._id) }, body: { action: 'accept', policyAcknowledged: true } }, accepted); assert.equal(accepted.statusCode, 200);
  const hired = response(); await confirmOfferHire({ params: { offerId: second.body.offer.id }, user: { id: String(f.employer._id) } }, hired); assert.equal(hired.statusCode, 200);
  job = await Job.findById(job._id); assert.equal(job.status, 'In Progress'); assert.equal(job.hiredCount, 2); assert.equal(job.reservedOfferCount, 0); assert.equal(recruitmentState(job).recruitmentOpen, false);
  assert.equal((await JobApplication.findById(application._id)).workStatus, 'Not started');
});

test('a before-start cancellation reopens a funded slot while another hired worker keeps the job in progress', async () => {
  const f = await fixture('Not started', 2); const worker = await person('work');
  await JobApplication.create({ job: f.job._id, applicant: worker._id, status: 'Hired', agreedAmount: 500, workStatus: 'Not started' });
  await Job.updateOne({ _id: f.job._id }, { $set: { hiredCount: 2 } });
  await cancel(f);
  const job = await Job.findById(f.job._id); assert.equal(job.status, 'In Progress'); assert.equal(job.hiredCount, 1); assert.equal(recruitmentState(job).recruitmentOpen, true);
  assert.equal(await Job.countDocuments({ _id: job._id, ...availableJobFilter() }), 1);
});

test('closing and reopening recruitment preserve job progress; closing unused slots permits final settlement once', async () => {
  const f = await fixture('Submitted', 2);
  const req = { params: { id: String(f.job._id) }, user: { id: String(f.employer._id) } };
  const closed = response(); await changeJobStatus({ ...req, body: { status: 'Closed' } }, closed); assert.equal(closed.statusCode, 200); assert.equal(closed.body.job.status, 'In Progress'); assert.equal(closed.body.job.recruitmentOpen, false);
  const reopened = response(); await reopenJob(req, reopened); assert.equal(reopened.statusCode, 200); assert.equal(reopened.body.job.status, 'In Progress'); assert.equal(recruitmentState(reopened.body.job).recruitmentOpen, true);
  const closedAgain = response(); await changeJobStatus({ ...req, body: { status: 'Closed' } }, closedAgain); assert.equal(closedAgain.statusCode, 200);
  await settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id });
  await settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id });
  assert.equal((await Job.findById(f.job._id)).status, 'Completed'); assert.equal((await remainingJobFunds(f.job._id)).remaining, 0);
  assert.equal(await Transaction.countDocuments({ reference: `completion-refund:${f.job._id}` }), 1);
});

test('closing recruitment after the last hired worker was paid completes a partially filled job', async () => {
  const f = await fixture('Submitted', 2);
  await settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id });
  assert.equal((await Job.findById(f.job._id)).status, 'In Progress');
  const closed = response(); await changeJobStatus({ params: { id: String(f.job._id) }, user: { id: String(f.employer._id) }, body: { status: 'Closed' } }, closed);
  assert.equal(closed.statusCode, 200); assert.equal(closed.body.job.status, 'Completed'); assert.equal((await remainingJobFunds(f.job._id)).remaining, 0);
});

test('authenticated PATCH recruitment routes keep the job in progress and enforce employer ownership', async () => {
  const f = await fixture('Not started', 2);
  const tokenFor = async (user) => { const session = await Session.create({ user: user._id }); return jwt.sign({ userId: String(user._id), sessionId: String(session._id) }, getJwtSecret()); };
  const employerToken = await tokenFor(f.employer); const workerToken = await tokenFor(f.worker);
  const app = express(); app.use(express.json()); app.use('/api/jobs', JobRoute);
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/jobs/${f.job._id}`;
  const headers = { Authorization: `Bearer ${employerToken}`, 'Content-Type': 'application/json' };
  try {
    const denied = await fetch(`${base}/status`, { method: 'PATCH', headers: { ...headers, Authorization: `Bearer ${workerToken}` }, body: JSON.stringify({ status: 'Closed' }) }); assert.equal(denied.status, 403);
    const closed = await fetch(`${base}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'Closed' }) }); assert.equal(closed.status, 200); const result = await closed.json(); assert.equal(result.job.status, 'In Progress'); assert.equal(result.job.recruitmentOpen, false);
    const reopened = await fetch(`${base}/reopen`, { method: 'PATCH', headers, body: '{}' }); assert.equal(reopened.status, 200); assert.equal((await reopened.json()).job.status, 'In Progress'); assert.equal(recruitmentState(await Job.findById(f.job._id)).recruitmentOpen, true);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('Mark done closes remaining recruitment and settles a partially filled job without duplicate payment', async (t) => {
  const receipts = []; mockReceiptMail(t, async (mail) => { receipts.push(mail); });
  const f = await fixture('Submitted', 2);
  const req = { params: { id: String(f.job._id) }, user: { id: String(f.employer._id) }, body: { status: 'Completed', confirmed: true } };
  const done = response(); await changeJobStatus(req, done); assert.equal(done.statusCode, 200); assert.equal(done.body.job.status, 'Completed');
  assert.equal(await Notification.countDocuments({ deliveryKey: `job-paid:${f.application._id}`, user: f.worker._id }), 1, 'posting completion delivers the worker payment notification after commit');
  assert.equal((await Notification.findOne({ deliveryKey: `job-paid:${f.application._id}` })).title, `Job marked as done: ${f.job.title}`);
  assert.equal(await Notification.countDocuments({ user: f.worker._id }), 1, 'posting completion delivers one combined completion and payment alert');
  assert.equal(receipts.length, 2, 'posting completion emails both parties after commit');
  const replay = response(); await changeJobStatus(req, replay); assert.equal(replay.statusCode, 200);
  assert.equal(receipts.length, 2, 'repeating completion does not resend receipts');
  assert.equal((await User.findById(f.worker._id)).workerBalance, 600); assert.equal(await Transaction.countDocuments({ reference: `application-payout:${f.application._id}` }), 1);
});

test('migration reports legacy hired job phases without writes and applies phase updates without moving funds', async () => {
  const f = await fixture('Not started', 2); await Job.updateOne({ _id: f.job._id }, { $set: { status: 'Closed' } });
  const transactions = await Transaction.countDocuments(); const report = await migrateLifecycle();
  assert.ok(report.jobPhaseDifferences.some((item) => item.job === String(f.job._id))); assert.equal((await Job.findById(f.job._id)).status, 'Closed');
  await migrateLifecycle({ apply: true }); assert.equal((await Job.findById(f.job._id)).status, 'In Progress'); assert.equal(await Transaction.countDocuments(), transactions);
});

async function acceptedChecklistFixture(positionsNeeded = 1) {
  const f = await fixture('Not started', positionsNeeded);
  await JobApplication.updateOne({ _id: f.application._id }, { $set: { status: 'Offer Sent', startedAt: null } });
  await Job.updateOne({ _id: f.job._id }, { $set: { hiredCount: 0, reservedOfferCount: 1, status: positionsNeeded === 1 ? 'Closed' : 'Available' } });
  const offer = await JobOffer.findOneAndUpdate({ application: f.application._id }, { $set: { status: 'accepted' } }, { returnDocument: 'after' });
  return { ...f, offer };
}

test('job offers notify the correct worker immediately and acceptance notifies the employer with the job conversation', async () => {
  const f = await fixture();
  const stranger = await person('work');
  await JobOffer.deleteMany({ application: f.application._id });
  await JobApplication.updateOne({ _id: f.application._id }, { $set: { status: 'Shortlisted' } });
  await Job.updateOne({ _id: f.job._id }, { $set: { hiredCount: 0, reservedOfferCount: 0, status: 'Available' } });
  const denied = response();
  await createJobOffer({ params: { applicationId: String(f.application._id) }, user: { id: String(stranger._id) }, body: { amount: 500 } }, denied);
  assert.equal(denied.statusCode, 403);
  assert.equal(await Notification.countDocuments(), 0);
  const offered = response();
  await createJobOffer({ params: { applicationId: String(f.application._id) }, user: { id: String(f.employer._id) }, body: { amount: 500 } }, offered);
  assert.equal(offered.statusCode, 201);
  const received = await Notification.findOne({ deliveryKey: `offer-created:${offered.body.offer.id}` });
  assert.equal(String(received.user), String(f.worker._id));
  assert.equal(received.audience, 'worker');
  assert.equal(received.metadata.jobId, String(f.job._id));
  assert.equal(received.link, `/worker/messages?startUser=${f.employer._id}&jobId=${f.job._id}`);
  assert.match(received.message, /Test work/);
  const accepted = response();
  await respondToJobOffer({ params: { offerId: offered.body.offer.id }, user: { id: String(f.worker._id) }, body: { action: 'accept', policyAcknowledged: true } }, accepted);
  assert.equal(accepted.statusCode, 200);
  const notice = await Notification.findOne({ deliveryKey: `offer-response:${offered.body.offer.id}:accepted` });
  assert.equal(String(notice.user), String(f.employer._id));
  assert.equal(notice.link, `/employer/messages?startUser=${f.worker._id}&jobId=${f.job._id}`);
  await deliverQueuedNotification(`offer-response:${offered.body.offer.id}:accepted`);
  assert.equal(await Notification.countDocuments({ deliveryKey: notice.deliveryKey }), 1);
  const readByOther = response();
  await markNotificationRead({ params: { notificationId: String(received._id) }, user: { id: String(stranger._id), role: 'work' }, query: { mode: 'worker' } }, readByOther);
  assert.equal(readByOther.statusCode, 404);
  const read = response();
  await markNotificationRead({ params: { notificationId: String(received._id) }, user: { id: String(f.worker._id), role: 'work' }, query: { mode: 'worker' } }, read);
  assert.equal(read.statusCode, 200);
  assert.ok((await Notification.findById(received._id)).readAt);
});

test('worker cancellation requests immediately notify only the owning employer and identify the assignment', async () => {
  for (const state of ['Not started', 'In Progress']) {
    const f = await fixture(state);
    const request = await cancel(f, { workerPayment: 0 });
    const notice = await Notification.findOne({ deliveryKey: `cancellation-request:${request._id}` });
    assert.equal(String(notice.user), String(f.employer._id));
    assert.equal(notice.audience, 'employer');
    assert.equal(notice.metadata.jobId, String(f.job._id));
    assert.equal(notice.metadata.cancellationId, String(request._id));
    assert.equal(notice.link, `/employer/applications?applicationId=${f.application._id}&jobId=${f.job._id}`);
    if (state === 'Not started') assert.match(notice.message, /no response is needed/);
  }
});

test('financial dispute notifications immediately open the exact case for both participants', async () => {
  const f = await fixture('In Progress');
  const res = response();
  await openDispute({ params: { applicationId: String(f.application._id) }, user: { id: String(f.worker._id) }, body: { reason: 'Payment terms need investigation', kind: 'other' } }, res);
  assert.equal(res.statusCode, 201);
  const dispute = res.body.dispute;
  for (const [user, audience] of [[f.employer, 'employer'], [f.worker, 'worker']]) {
    const notice = await Notification.findOne({ deliveryKey: `dispute:${dispute._id}:${user._id}` });
    assert.equal(notice.entityType, 'financial_dispute');
    assert.equal(notice.entityId, String(dispute._id));
    assert.equal(notice.metadata.jobId, String(f.job._id));
    assert.equal(notice.link, `/${audience}/financial-disputes?disputeId=${dispute._id}`);
  }
});

test('hire checklists remain specific to each worker and are sent once as read-only chat descriptions', async () => {
  const f = await acceptedChecklistFixture(2); const worker = await person('work');
  const secondApp = await JobApplication.create({ job: f.job._id, applicant: worker._id, status: 'Offer Sent' });
  const secondOffer = await JobOffer.create({ job: f.job._id, application: secondApp._id, employer: f.employer._id, worker: worker._id, amount: 500, status: 'accepted' });
  await Job.updateOne({ _id: f.job._id }, { $set: { reservedOfferCount: 2 } });
  const hire = (offer, checklist) => ({ params: { offerId: String(offer._id) }, user: { id: String(f.employer._id) }, body: { checklist } });
  const first = response(); await confirmOfferHire(hire(f.offer, [' Clean the floor ', 'Bag the waste']), first); assert.equal(first.statusCode, 200);
  const second = response(); await confirmOfferHire(hire(secondOffer, ['Paint the fence']), second); assert.equal(second.statusCode, 200);
  assert.deepEqual(first.body.application.hireChecklist.map((item) => item.description), ['Clean the floor', 'Bag the waste']);
  assert.deepEqual(second.body.application.hireChecklist.map((item) => item.description), ['Paint the fence']);
  assert.ok(first.body.application.hireChecklist.every((item) => item.completed === false));
  const messages = await Message.find({ 'attachment.type': 'hire_checklist' }); assert.equal(messages.length, 2);
  for (const [offer, recipient] of [[f.offer, f.worker], [secondOffer, worker]]) {
    const notice = await Notification.findOne({ deliveryKey: `checklist-created:${offer._id}` });
    assert.equal(String(notice.user), String(recipient._id));
    assert.equal(notice.entityType, 'hire_checklist');
    assert.equal(notice.link, `/worker/messages?startUser=${f.employer._id}&jobId=${f.job._id}`);
    assert.equal(notice.metadata.applicationId, String(offer.application));
  }
  const sent = messages.find((message) => String(message.receiver) === String(f.worker._id));
  assert.deepEqual([...sent.attachment.checklist], ['Clean the floor', 'Bag the waste']); assert.equal(String(sent.job), String(f.job._id)); assert.equal(String(sent.attachment.application), String(f.application._id));
  const retry = response(); await confirmOfferHire(hire(f.offer, ['Different checklist']), retry); assert.equal(retry.statusCode, 404); assert.equal(await Message.countDocuments({ 'attachment.type': 'hire_checklist' }), 2);
  const details = response(); await getEmployerApplications({ user: { id: String(f.employer._id) }, query: { jobId: String(f.job._id), includeHidden: 'true' } }, details); assert.equal(details.statusCode, 200); assert.equal(details.body.length, 2); assert.ok(details.body.every((item) => item.hireChecklist.length));
});

test('omitted checklists preserve ordinary hiring and invalid checklists cannot partially hire', async () => {
  const f = await acceptedChecklistFixture();
  const req = { params: { offerId: String(f.offer._id) }, user: { id: String(f.employer._id) } };
  const invalid = response(); await confirmOfferHire({ ...req, body: { checklist: [''] } }, invalid); assert.equal(invalid.statusCode, 400);
  assert.equal((await JobApplication.findById(f.application._id)).status, 'Offer Sent'); assert.equal((await JobOffer.findById(f.offer._id)).status, 'accepted');
  const hired = response(); await confirmOfferHire(req, hired); assert.equal(hired.statusCode, 200); assert.equal(hired.body.application.hireChecklist.length, 0); assert.equal(await Message.countDocuments({ 'attachment.type': 'hire_checklist' }), 0);
});

test('a checklist notification delivery failure preserves the hire and retries once from the durable outbox', async (t) => {
  const f = await acceptedChecklistFixture();
  const failing = t.mock.method(Notification, 'findOneAndUpdate', async () => { throw new Error('Notification service interrupted'); });
  const res = response();
  await confirmOfferHire({ params: { offerId: String(f.offer._id) }, user: { id: String(f.employer._id) }, body: { checklist: ['Clean the floor'] } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal((await JobApplication.findById(f.application._id)).status, 'Hired');
  const key = `checklist-created:${f.offer._id}`;
  assert.equal((await NotificationOutbox.findOne({ key })).status, 'pending');
  failing.mock.restore();
  await NotificationOutbox.updateOne({ key }, { $set: { availableAt: new Date(0) } });
  await deliverQueuedNotification(key); await deliverQueuedNotification(key);
  assert.equal(await Notification.countDocuments({ deliveryKey: key, user: f.worker._id }), 1);
});

test('a failed checklist message rolls back the hire, checklist, reservation, and notification', async (t) => {
  const f = await acceptedChecklistFixture();
  t.mock.method(Message, 'create', async () => { throw new Error('Simulated message persistence failure'); });
  const res = response(); await confirmOfferHire({ params: { offerId: String(f.offer._id) }, user: { id: String(f.employer._id) }, body: { checklist: ['Clean the floor'] } }, res); assert.equal(res.statusCode, 500);
  const application = await JobApplication.findById(f.application._id); assert.equal(application.status, 'Offer Sent'); assert.equal(application.hireChecklist.length, 0);
  const job = await Job.findById(f.job._id); assert.equal(job.hiredCount, 0); assert.equal(job.reservedOfferCount, 1);
  assert.equal((await JobOffer.findById(f.offer._id)).status, 'accepted'); assert.equal(await NotificationOutbox.countDocuments({ key: `hired:${f.offer._id}` }), 0);
});

test('only the employer can track checklist items and unchecked tasks never block evidence or completion', async (t) => {
  mockEvidenceAzure(t);
  const f = await acceptedChecklistFixture(); const stranger = await person('hire');
  const hired = response(); await confirmOfferHire({ params: { offerId: String(f.offer._id) }, user: { id: String(f.employer._id) }, body: { checklist: ['Clean the floor', 'Bag the waste'] } }, hired); assert.equal(hired.statusCode, 200);
  const itemId = String(hired.body.application.hireChecklist[0]._id);
  const params = { applicationId: String(f.application._id), itemId };
  for (const user of [f.worker, stranger]) { const denied = response(); await updateHireChecklistItem({ params, user: { id: String(user._id) }, body: { completed: true } }, denied); assert.equal(denied.statusCode, 403); }
  const invalid = response(); await updateHireChecklistItem({ params, user: { id: String(f.employer._id) }, body: { completed: 'true' } }, invalid); assert.equal(invalid.statusCode, 400);
  const marked = response(); await updateHireChecklistItem({ params, user: { id: String(f.employer._id) }, body: { completed: true } }, marked); assert.equal(marked.statusCode, 200); assert.equal(marked.body.checklist[0].completed, true);
  let application = await JobApplication.findById(f.application._id); assert.equal(application.workStatus, 'Not started'); assert.equal(application.paymentStatus, 'Secured'); assert.equal((await Job.findById(f.job._id)).status, 'In Progress'); assert.equal(await Transaction.countDocuments({ type: 'PAYOUT' }), 0);
  const started = response(); await startWork({ params: { applicationId: params.applicationId }, user: { id: String(f.worker._id) } }, started); assert.equal(started.statusCode, 200);
  const submitted = response(); await submitWork({ params: { applicationId: params.applicationId }, user: { id: String(f.worker._id) }, body: {}, files: [photo()] }, submitted); assert.equal(submitted.statusCode, 200);
  await settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id });
  application = await JobApplication.findById(f.application._id); assert.equal(application.workStatus, 'Completed'); assert.equal(application.paymentStatus, 'Paid'); assert.equal(application.hireChecklist[1].completed, false); assert.equal((await Job.findById(f.job._id)).status, 'Completed');
  const unmarked = response(); await updateHireChecklistItem({ params, user: { id: String(f.employer._id) }, body: { completed: false } }, unmarked); assert.equal(unmarked.statusCode, 200); assert.equal((await Job.findById(f.job._id)).status, 'Completed');
});

test('identifier throttles are shared between instances and keep ObjectId database invariants', async () => {
  const one = new MongoRateLimitStore('test'); const two = new MongoRateLimitStore('test'); one.init({ windowMs: 180000 }); two.init({ windowMs: 180000 });
  const hits = await Promise.all(Array.from({ length: 8 }, (_, i) => (i % 2 ? one : two).increment('account@example.com')));
  assert.equal(Math.max(...hits.map((value) => value.totalHits)), 8);
  const row = await AuthRateBucket.findOne(); assert.ok(row._id instanceof mongoose.Types.ObjectId); assert.ok(!row.key.includes('account@example.com'));
  assert.equal(new Set(hits.map((value) => value.resetTime.getTime())).size, 1);
});

test('invalid transfer callbacks cannot change balances, and CSV formula cells are neutralized', async () => {
  const res = response(); res.sendStatus = function (code) { this.statusCode = code; return this; };
  process.env.PAYMONGO_TRANSFER_WEBHOOK_SECRET = 'secret';
  await transferWebhook({ rawBody: Buffer.from('{}'), get: () => 't=invalid,te=forged', body: {} }, res);
  assert.equal(res.statusCode, 401); assert.equal(await Transaction.countDocuments(), 0);
  assert.equal(csvCell('=HYPERLINK("example")'), '"\'=HYPERLINK(""example"")"');
});

test('financial complaints after payment preserve the paid ledger and cannot award it again', async () => {
  const f = await fixture('Submitted');
  await settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id });
  const before = await Transaction.countDocuments();
  const opened = response(); await openDispute({ params: { applicationId: f.application._id }, user: { id: String(f.worker._id) }, body: { kind: 'other', reason: 'Review payment terms' } }, opened);
  assert.equal(opened.statusCode, 201); const dispute = opened.body.dispute;
  assert.equal(dispute.amount, 0); assert.equal((await JobApplication.findById(f.application._id)).disputePending, false);
  for (const user of [f.worker, f.employer]) await addEvidence({ params: { id: dispute._id }, user: { id: String(user._id) }, body: { noEvidence: true } }, response());
  const denied = response(); await updateAdminFinancialDispute({ params: { disputeId: dispute._id }, user: { id: String(f.employer._id) }, body: { status: 'resolved', workerPayment: 600, resolutionNotes: 'Attempt to pay again' } }, denied); assert.equal(denied.statusCode, 409);
  await completeInvestigation(dispute);
  await assert.rejects(proposeDisputeSettlement({ disputeId: dispute._id, financeUserId: new mongoose.Types.ObjectId(), settlementType: 'PARTIAL_PAYMENT', workerAmount: 600, employerRefund: 0, decisionReason: 'Invalid repeated payment' }), /exceed/);
  await financeResolve(dispute, 0);
  assert.equal(await Transaction.countDocuments(), before); assert.equal((await User.findById(f.worker._id)).workerBalance, 600); assert.equal((await JobApplication.findById(f.application._id)).paymentStatus, 'Paid');
});

test('mixed-wallet job cancellation refunds each original source and does not rewrite the ledger', async () => {
  const employer = await person('both', 220); await User.updateOne({ _id: employer._id }, { $set: { workerBalance: 300, avatarUrl: '/profile.png' } });
  const category = await Category.create({ name: 'Mixed funding' });
  const res = response(); await createJob({ user: { id: String(employer._id), role: 'both' }, body: { title: 'Mixed funding work', description: 'Work', location: 'Pasig', salary: 500, jobType: 'Short-term', deadline: new Date(Date.now() + 24 * HOUR), category: String(category._id) }, get: () => '' }, res);
  assert.equal(res.statusCode, 201); const job = { ...res.body.job, _id: new mongoose.Types.ObjectId(resolvePublicId(res.body.job._id)) };
  assert.equal((await User.findById(employer._id)).employerBalance, 0); assert.equal((await User.findById(employer._id)).workerBalance, 0);
  await requestCancellation({ jobId: job._id, actor: employer._id, reason: 'No longer required', policyAcknowledged: true });
  const restored = await User.findById(employer._id); assert.equal(restored.employerBalance, 200); assert.equal(restored.workerBalance, 300);
  assert.equal(await Transaction.countDocuments({ jobReference: job._id }), 3); assert.equal((await remainingJobFunds(job._id)).remaining, 0);
});
test('simultaneous job funding and withdrawal cannot spend the same available balance', async () => {
  const worker = await person('both', 500); await User.updateOne({ _id: worker._id }, { $set: { employerBalance: 0, avatarUrl: '/profile.png' } });
  const category = await Category.create({ name: 'Funding race' });
  const preview = await previewWithdrawal(worker._id, { sourceWallet: 'WORKER', amount: 500, destinationSnapshot: { methodType: 'bank_transfer', institutionName: 'Test bank', accountName: 'Test', accountNumber: '12345678' } });
  const res = response(); const outcomes = await Promise.allSettled([
    createJob({ user: { id: String(worker._id), role: 'both' }, body: { title: 'Concurrent funding', description: 'Work', location: 'Pasig', salary: 500, jobType: 'Short-term', deadline: new Date(Date.now() + 24 * HOUR), category: String(category._id) }, get: () => '' }, res),
    confirmWithdrawal(worker._id, { previewToken: preview.previewToken, detailsConfirmed: true }),
  ]);
  assert.equal(outcomes.length, 2); const current = await User.findById(worker._id); assert.equal(current.workerBalance, 0);
  assert.equal(await Job.countDocuments() + await PayoutRequest.countDocuments(), 1); assert.equal(await Transaction.countDocuments(), 1);
});
test('unanswered cancellation escalates after 72 hours and missing evidence cannot force an early decision', async () => {
  const f = await fixture('In Progress'); const pending = await cancel(f, { workerPayment: 200 });
  await Cancellation.updateOne({ _id: pending._id }, { $set: { responseDueAt: new Date(Date.now() - 1) } });
  await runMaintenance(); assert.equal((await Cancellation.findById(pending._id)).status, 'staff_review');
  const Dispute = mongoose.model('FinancialDispute'); const dispute = await Dispute.findOne(); assert.equal(dispute.amount, 600);
  await completeInvestigation(dispute);
  await assert.rejects(proposeDisputeSettlement({ disputeId: dispute._id, financeUserId: new mongoose.Types.ObjectId(), settlementType: 'FULL_REFUND', decisionReason: 'No evidence yet' }), /seven days/);
  assert.equal((await remainingJobFunds(f.job._id)).remaining, 600);
});

test('cancellation exports retain reasons and linked ledger records; financial exports require finance permission', async () => {
  const f = await fixture(); await cancel(f);
  const exported = response(); await exportLifecycleReport({ params: { type: 'cancellations' }, query: {}, user: { role: 'superadmin' } }, exported);
  assert.equal(exported.statusCode, 200); assert.equal(exported.body.rows[0].reason, 'Cannot attend'); assert.match(exported.body.rows[0].linkedTransactions, /assignment-cancellation-refund/);
  const denied = response(); denied.sendStatus = function (code) { this.statusCode = code; return this; }; await exportLifecycleReport({ params: { type: 'financial-history' }, query: {}, user: { role: 'admin', staffRole: 'support_team' } }, denied); assert.equal(denied.statusCode, 403);
});
test('financial history reports separate withdrawal approval, ledger status, reserved funds and account labels', async () => {
  const f = await fixture();
  const [payout] = await PayoutRequest.create([{ user: f.worker._id, amount: 50, sourceWallet: 'WORKER', status: 'approved', processingMode: 'manual', destinationSnapshot: { methodType: 'bank_transfer', institutionName: 'Test bank', accountName: 'Worker', accountNumber: '12345678' } }]);
  const tx = await Transaction.create({ sender: f.worker._id, type: 'PAYOUT', amount: 50, status: 'PENDING', payoutRequest: payout._id, balanceTarget: 'WORKER' });
  const res = response();
  await exportLifecycleReport({ params: { type: 'financial-history' }, query: {}, user: { role: 'superadmin' } }, res);
  assert.equal(res.statusCode, 200);
  const withdrawal = res.body.rows.find((row) => row.id === String(tx._id));
  assert.equal(withdrawal.status, 'PENDING');
  assert.equal(withdrawal.ledgerStatusLabel, 'Pending');
  assert.equal(withdrawal.statusLabel, 'Approved; awaiting transfer');
  assert.equal(withdrawal.transactionTypeCode, 'PAYOUT');
  assert.equal(withdrawal.transactionTypeLabel, 'Withdrawal');
  assert.equal(withdrawal.sourceWalletLabel, 'Worker wallet');
  assert.equal(withdrawal.currency, 'PHP');
  const reservation = res.body.rows.find((row) => row.type === 'ESCROW');
  assert.equal(reservation.statusLabel, 'Funds reserved');
  assert.equal(reservation.balanceTargetLabel, 'Reserved job funds');
  assert.equal(reservation.sourceWalletLabel, 'Not recorded');
  assert.equal(reservation.sourceWallet, '');
});

test('unknown legacy dual-wallet contributions are flagged and never silently refunded to another wallet', async () => {
  const f = await fixture(); await User.updateOne({ _id: f.employer._id }, { $set: { role: 'both' } });
  const report = await migrateLifecycle(); assert.ok(report.ambiguousFunds.some((item) => item.job === String(f.job._id)));
  await assert.rejects(cancel(f), /funding sources require/); assert.equal((await User.findById(f.employer._id)).employerBalance, 1000); assert.equal(await Transaction.countDocuments({ type: 'REFUND' }), 0);
});

test('authenticated duplicate transfer callbacks reconcile once and retain provider fees and rail references', async () => {
  const employer = await person('hire', 400);
  process.env.PAYMONGO_SECRET_KEY = 'sk_test_callbacks'; process.env.PAYMONGO_TRANSFER_WEBHOOK_SECRET = 'callback-secret';
  const payout = await PayoutRequest.create({ user: employer._id, sourceWallet: 'EMPLOYER', processingMode: 'automatic', amount: 100, totalDebit: 100, status: 'processing', dispatchStartedAt: new Date(), destinationSnapshot: { methodType: 'bank_transfer', institutionName: 'Test Bank', accountName: 'Test', accountNumber: '12345678', bic: 'TESTPH' } });
  const tx = await Transaction.create({ sender: employer._id, amount: 100, type: 'PAYOUT', status: 'PENDING', payoutRequest: payout._id }); payout.transaction = tx._id; await payout.save();
  const transfer = { id: 'tr_callback', status: 'succeeded', reference_number: `PAYOUT-${payout._id}`, amount: 10000, fee: 800, currency: 'PHP', provider_reference_number: 'bank-reference', destination_account: { number: '12345678', bic: 'TESTPH' } };
  const body = { data: transfer }; const rawBody = Buffer.from(JSON.stringify(body)); const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto.createHmac('sha256', 'callback-secret').update(`${timestamp}.`).update(rawBody).digest('hex'); const get = axios.get;
  try {
    axios.get = async () => ({ data: { data: transfer } });
    for (let i = 0; i < 2; i += 1) { const res = response(); res.sendStatus = function (code) { this.statusCode = code; return this; }; await transferWebhook({ body, rawBody, get: () => `t=${timestamp},te=${signature},li=` }, res); assert.equal(res.statusCode, 200); }
    const done = await PayoutRequest.findById(payout._id); assert.equal(done.status, 'paid'); assert.equal(done.providerFee, 8); assert.equal(done.providerRailReference, 'bank-reference'); assert.equal(done.events.filter((item) => item.status === 'paid').length, 1);
    assert.equal((await User.findById(employer._id)).employerBalance, 400); assert.equal((await Transaction.findById(tx._id)).status, 'COMPLETED');
  } finally { axios.get = get; }
});

test('posting payment summaries show work awaiting approval and preserve partial cancellation outcomes', async () => {
  const f = await fixture('Submitted'); const req = { user: { id: String(f.employer._id) } };
  const awaiting = response(); await getMyJobs(req, awaiting); assert.equal(awaiting.body[0].paymentSummary.status, 'Awaiting approval');
  const pending = await cancel(f, { workerPayment: 200 }); const held = response(); await getMyJobs(req, held); assert.equal(held.body[0].paymentSummary.status, 'On hold');
  await respondCancellation({ cancellationId: pending._id, actor: f.employer._id, action: 'accept' });
  const partial = response(); await getMyJobs(req, partial); assert.equal(partial.body[0].paymentSummary.status, 'Partially paid'); assert.equal(partial.body[0].paymentSummary.paid, 200);
});

test('Finance cancellation settlement preserves other workers and needs an independent approver', async () => {
  const f = await fixture('In Progress', 2);
  const other = await person('work');
  const otherApp = await JobApplication.create({ job: f.job._id, applicant: other._id, status: 'Hired', agreedAmount: 500, workStatus: 'Not started' });
  const cancellation = await cancel(f, { workerPayment: 200 });
  await respondCancellation({ cancellationId: cancellation._id, actor: f.employer._id, action: 'reject' });
  const dispute = await mongoose.model('FinancialDispute').findOne({ application: f.application._id });
  for (const user of [f.worker, f.employer]) await addEvidence({ params: { id: dispute._id }, user: { id: String(user._id) }, body: { noEvidence: true } }, response());
  const current = await mongoose.model('FinancialDispute').findById(dispute._id);
  const result = await financeResolve(current, 200);
  assert.equal(result.dispute.status, 'resolved');
  assert.equal((await Cancellation.findById(cancellation._id)).status, 'resolved');
  assert.equal((await JobApplication.findById(f.application._id)).status, 'Cancelled');
  assert.equal((await JobApplication.findById(otherApp._id)).status, 'Hired');
  assert.equal((await remainingJobFunds(f.job._id)).remaining, 500);
  assert.equal((await User.findById(f.worker._id)).workerBalance, 200);
  await approveAndProcessDisputeSettlement({ disputeId: dispute._id, approverId: result.dispute.financeSettlement.approvedBy });
  assert.equal((await User.findById(f.worker._id)).workerBalance, 200);
});

test('migration preserves recorded employer wallet sources on older withdrawals', async () => {
  const employer = await person('hire');
  const id = new mongoose.Types.ObjectId();
  await PayoutRequest.collection.insertOne({ _id: id, user: employer._id, amount: 100, balanceTarget: 'EMPLOYER', status: 'requested', destinationSnapshot: { methodType: 'bank_transfer', institutionName: 'Bank', accountName: 'Employer', accountNumber: '12345678' } });
  assert.equal((await PayoutRequest.findById(id)).sourceWallet, 'EMPLOYER');
  await migrateLifecycle();
  assert.equal((await PayoutRequest.collection.findOne({ _id: id })).sourceWallet, undefined);
  await migrateLifecycle({ apply: true });
  assert.equal((await PayoutRequest.findById(id)).sourceWallet, 'EMPLOYER');
});


test('direct settlement pays only the remaining amount after a recorded partial payment', async () => {
  const f = await fixture('Submitted');
  await User.updateOne({ _id: f.worker._id }, { $set: { workerBalance: 250 } });
  await Transaction.create({ receiver: f.worker._id, amount: 250, type: 'PAYOUT', status: 'COMPLETED', balanceTarget: 'WORKER', jobReference: f.job._id, relatedEntityType: 'job_application', relatedEntityId: String(f.application._id), reference: `prior-partial:${f.application._id}` });
  const preview = response();
  await previewPayment({ params: { applicationId: f.application._id }, user: { id: String(f.employer._id) } }, preview);
  assert.equal(preview.statusCode, 200); assert.equal(preview.body.amount, 350);
  const result = await settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id });
  assert.equal(result.transaction.amount, 350);
  assert.equal(result.application.paidAmount, 600);
  assert.equal((await User.findById(f.worker._id)).workerBalance, 600);
  assert.equal((await remainingJobFunds(f.job._id)).remaining, 0);
  await settleApplicationPayment({ applicationId: f.application._id, employerId: f.employer._id });
  assert.equal((await User.findById(f.worker._id)).workerBalance, 600);
});
