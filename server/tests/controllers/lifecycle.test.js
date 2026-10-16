import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import axios from 'axios';
import crypto from 'node:crypto';
import Job from '../../models/Job.js';
import User from '../../models/User.js';
import JobApplication from '../../models/JobApplication.js';
import JobOffer from '../../models/JobOffer.js';
import Transaction from '../../models/Transaction.js';
import PayoutRequest from '../../models/PayoutRequest.js';
import Cancellation from '../../models/Cancellation.js';
import NotificationOutbox from '../../models/NotificationOutbox.js';
import Notification from '../../models/Notification.js';
import { requestCancellation, respondCancellation } from '../../services/jobLifecycle.js';
import { remainingJobFunds } from '../../services/jobFunds.js';
import { settleApplicationPayment } from '../../services/applicationSettlement.js';
import { previewWithdrawal, confirmWithdrawal, reconcileWithdrawal } from '../../services/withdrawals.js';
import { runMaintenance } from '../../services/maintenance.js';
import { previewPayment } from '../../controllers/ApplicationPaymentController.js';
import { startWork, openDispute, addEvidence } from '../../controllers/LifecycleController.js';
import { updateAdminFinancialDispute } from '../../controllers/AdminFinanceDisputeController.js';
import { proposeDisputeSettlement, approveAndProcessDisputeSettlement } from '../../services/financialDisputeSettlement.js';
import { resolvePublicId } from '../../lib/publicId.js';
import { canFileNonpayment, HOUR } from '../../lib/lifecyclePolicy.js';
import { migrateLifecycle } from '../../scripts/migrateLifecycle.js';
import Category from '../../models/Category.js';
import { createJob, deleteJob, reopenJob, getMyJobs } from '../../controllers/JobController.js';
import { createJobOffer, respondToJobOffer, confirmOfferHire } from '../../controllers/JobOfferController.js';
import { updateInterview } from '../../controllers/JobApplicationController.js';
import { MongoRateLimitStore } from '../../lib/mongoRateLimitStore.js';
import AuthRateBucket from '../../models/AuthRateBucket.js';
import { transferWebhook } from '../../controllers/WithdrawalController.js';
import { csvCell, exportLifecycleReport } from '../../controllers/LifecycleReportController.js';

let mongo;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri(), { dbName: 'lifecycle' }); await Promise.all([Transaction.init(), PayoutRequest.init(), NotificationOutbox.init(), JobApplication.init(), Notification.init(), AuthRateBucket.init()]); });
beforeEach(async () => { for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({}); delete process.env.AUTOMATIC_WITHDRAWALS_ENABLED; });
after(async () => { await mongoose.disconnect(); await mongo.stop(); });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const person = (role, balance = 0) => User.create({ email: `${new mongoose.Types.ObjectId()}@example.com`, firstName: 'Test', lastName: role, role, status: 'active', employerBalance: balance, workerBalance: balance, passwordHashed: 'unused' });
async function fixture(workStatus = 'Not started', positionsNeeded = 1) {
  const [employer, worker] = await Promise.all([person('hire', 1000), person('work')]);
  const job = await Job.create({ title: 'Test work', description: 'Work', location: 'Pasig', salary: 500, jobType: 'Short-term', deadline: new Date(Date.now() + 24 * HOUR), jobPoster: employer._id, positionsNeeded, hiredCount: 1, status: positionsNeeded === 1 ? 'Closed' : 'Available' });
  const application = await JobApplication.create({ job: job._id, applicant: worker._id, status: 'Hired', agreedAmount: 600, workStatus, ...(workStatus !== 'Not started' ? { startedAt: new Date() } : {}) });
  await JobOffer.create({ job: job._id, application: application._id, employer: employer._id, worker: worker._id, amount: 600, additionalEscrow: 100, status: 'hired' });
  await Transaction.create({ sender: employer._id, amount: positionsNeeded * 500 + 100, type: 'ESCROW', status: 'COMPLETED', balanceTarget: 'ESCROW', jobReference: job._id });
  return { employer, worker, job, application };
}
const cancel = (f, extra = {}) => requestCancellation({ applicationId: f.application._id, actor: f.worker._id, reason: 'Cannot attend', policyAcknowledged: true, ...extra });

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
test('employer transfer timeout stays processing; verified failure returns funds exactly once', async () => {
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
    const preview = await previewWithdrawal(employer._id, { sourceWallet: 'EMPLOYER', amount: 100, destinationSnapshot: { methodType: 'bank_transfer', institutionName: 'Test Bank', bic: 'TESTPH', accountName: 'Employer', accountNumber: '12345678' } });
    const result = await confirmWithdrawal(employer._id, { previewToken: preview.previewToken, detailsConfirmed: true });
    assert.equal(result.status, 'processing'); assert.equal((await User.findById(employer._id)).employerBalance, 400);
    await confirmWithdrawal(employer._id, { previewToken: preview.previewToken, detailsConfirmed: true }); assert.equal(submissions, 1);
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
  assert.equal((await JobApplication.findById(app._id)).workStatus, 'Not started');
  assert.equal((await JobApplication.findById(otherApp._id)).status, 'Position filled');
  const started = response(); await startWork({ params: { applicationId: String(app._id) }, user: { id: String(worker._id) } }, started); assert.equal(started.statusCode, 200);
  assert.ok((await JobApplication.findById(app._id)).startedAt);
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
