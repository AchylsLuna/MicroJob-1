import NotificationOutbox from '../../models/NotificationOutbox.js';
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import FinancialDispute from '../../models/FinancialDispute.js';
import SupportTicket from '../../models/SupportTicket.js';
import Notification from '../../models/Notification.js';
import Transaction from '../../models/Transaction.js';
import User from '../../models/User.js';
import { openPaymentDispute } from '../../controllers/ApplicationPaymentController.js';
import { submitFinancialDisputeAppeal } from '../../controllers/FinancialDisputeController.js';
import { approveAndProcessDisputeSettlement, proposeDisputeSettlement } from '../../services/financialDisputeSettlement.js';
import { requirePermission } from '../../middleware/admin.js';
import { getMyJobs, getEmployerJobHistory } from '../../controllers/JobController.js';

let mongo;
const response = () => ({
  statusCode: 200,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});
const makeUser = async (role, email, staffRole = null) => {
  const user = new User({ email, firstName: 'Test', lastName: 'User', role, staffRole, status: 'active' });
  await user.setPassword('Password123!');
  return user.save();
};

before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: 'financial-disputes' });
  await Promise.all([Transaction.init(), FinancialDispute.init(), NotificationOutbox.init(), Notification.init()]);
});
beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Job.deleteMany({}), JobApplication.deleteMany({}),
    FinancialDispute.deleteMany({}), SupportTicket.deleteMany({}),
    Notification.deleteMany({}), NotificationOutbox.deleteMany({}), Transaction.deleteMany({}),
  ]);
});
after(async () => { await mongoose.disconnect(); await mongo.stop(); });

async function fixture({ agreed = 2500, alreadyPaid = 0, held = agreed } = {}) {
  const [employer, worker, support, finance, approver] = await Promise.all([
    makeUser('hire', `employer-${new mongoose.Types.ObjectId()}@example.com`),
    makeUser('work', `worker-${new mongoose.Types.ObjectId()}@example.com`),
    makeUser('admin', `support-${new mongoose.Types.ObjectId()}@example.com`, 'support_staff'),
    makeUser('admin', `finance-${new mongoose.Types.ObjectId()}@example.com`, 'finance_team'),
    makeUser('admin', `approver-${new mongoose.Types.ObjectId()}@example.com`, 'finance_team'),
  ]);
  const job = await Job.create({
    title: 'Five-day community job', description: 'Complete the agreed local work.', location: 'Pasig',
    salary: agreed, jobType: 'Short-term', deadline: new Date('2027-01-01'), jobPoster: employer._id, hiredCount: 1,
  });
  const application = await JobApplication.create({
    job: job._id, applicant: worker._id, status: 'Hired', agreedAmount: agreed,
    workStatus: 'Submitted', paymentStatus: 'Secured', workSubmittedAt: new Date(),
  });
  await Transaction.create({ sender: employer._id, amount: held, type: 'ESCROW', status: 'COMPLETED', balanceTarget: 'ESCROW', jobReference: job._id });
  if (alreadyPaid > 0) {
    await Transaction.create({
      sender: null, receiver: worker._id, amount: alreadyPaid, type: 'PAYOUT', status: 'COMPLETED',
      balanceTarget: 'WORKER', jobReference: job._id, reference: `application-payout:prior:${application._id}`,
      relatedEntityType: 'job_application', relatedEntityId: String(application._id),
    });
    worker.workerBalance = alreadyPaid;
    await worker.save();
  }
  return { employer, worker, support, finance, approver, job, application };
}

async function open({ worker, application, disputedAmount, reason = 'The correct agreed payment was not received.' }) {
  const res = response();
  await openPaymentDispute({ params: { applicationId: String(application._id) }, user: { id: String(worker._id), role: 'work' }, body: { reason, disputedAmount } }, res);
  assert.equal(res.statusCode, 201, JSON.stringify(res.payload));
  return FinancialDispute.findById(res.payload.dispute._id);
}

async function completeReport(dispute, support) {
  // Model a case reviewed after both parties received their full evidence window.
  dispute.evidenceDueAt = new Date(Date.now() - 1);
  dispute.assignedSupportUserId = support._id;
  dispute.investigationReport = {
    status: 'COMPLETED', jobDescription: 'Five-day job', workCompletionFindings: 'Evidence reviewed.',
    paymentFindings: 'Ledger reviewed.', timelineSummary: 'Submission followed by dispute.',
    supportNotes: 'Internal neutral notes.', recommendedFacts: 'Facts only; no settlement selected.',
    completedAt: new Date(), supportAgent: support._id,
  };
  dispute.investigationStatus = 'FOR_FINANCE_REVIEW';
  await dispute.save();
  return dispute;
}

async function settle({ dispute, support, finance, approver, settlementType, workerAmount, employerRefund, reason = 'Decision based on the completed investigation report.' }) {
  await completeReport(dispute, support);
  await proposeDisputeSettlement({ disputeId: dispute._id, financeUserId: finance._id, settlementType, workerAmount, employerRefund, decisionReason: reason });
  return approveAndProcessDisputeSettlement({ disputeId: dispute._id, approverId: approver._id });
}

test('scenario 1: complete payment releases the correct remaining amount after full completion', async () => {
  const data = await fixture();
  const dispute = await open({ ...data, disputedAmount: 2500 });
  const result = await settle({ ...data, dispute, settlementType: 'COMPLETE_PAYMENT' });
  assert.equal(result.dispute.financeSettlement.workerSettlementAmount, 2500);
  assert.equal((await User.findById(data.worker._id)).workerBalance, 2500);
  assert.equal(result.dispute.investigationStatus, 'RESOLVED');
  assert.equal(result.dispute.paymentStatus, 'PAID');
  assert.equal((await Job.findById(data.job._id)).status, 'Completed');
});

test('scenario 2: partial work settlement allocates worker and employer amounts exactly', async () => {
  const data = await fixture();
  const dispute = await open({ ...data, disputedAmount: 2500, reason: 'Three of five agreed work days were completed.' });
  const result = await settle({ ...data, dispute, settlementType: 'PARTIAL_PAYMENT', workerAmount: 1500, employerRefund: 1000 });
  assert.equal(result.dispute.financeSettlement.workerSettlementAmount, 1500);
  assert.equal(result.dispute.financeSettlement.employerRefundAmount, 1000);
  assert.equal((await User.findById(data.worker._id)).workerBalance, 1500);
  assert.equal((await User.findById(data.employer._id)).employerBalance, 1000);
  assert.equal((await Job.findById(data.job._id)).status, 'Closed');
});

test('scenario 3: full refund returns only eligible held funds', async () => {
  const data = await fixture();
  const dispute = await open({ ...data, disputedAmount: 2500 });
  const result = await settle({ ...data, dispute, settlementType: 'FULL_REFUND' });
  assert.equal(result.dispute.financeSettlement.workerSettlementAmount, 0);
  assert.equal(result.dispute.financeSettlement.employerRefundAmount, 2500);
  assert.equal(result.dispute.financeSettlement.outstandingAmount, 0);
  assert.equal((await User.findById(data.worker._id)).workerBalance, 0);
  assert.equal((await User.findById(data.employer._id)).employerBalance, 2500);
  assert.equal((await Job.findById(data.job._id)).status, 'Closed');
  const management = response();
  await getMyJobs({ user: { id: String(data.employer._id) } }, management);
  assert.equal(management.statusCode, 200);
  assert.equal(management.payload.length, 1);
  const history = response();
  await getEmployerJobHistory({ user: { id: String(data.employer._id) } }, history);
  assert.equal(history.payload.length, 1);
  assert.equal(history.payload[0].status, 'Closed');
});

test('scenario 4: complete payment accounts for an earlier partial payout and never double-pays', async () => {
  const data = await fixture({ alreadyPaid: 1000 });
  const dispute = await open({ ...data, disputedAmount: 1500 });
  const result = await settle({ ...data, dispute, settlementType: 'COMPLETE_PAYMENT' });
  assert.equal(result.dispute.financeSettlement.alreadyPaidAmount, 1000);
  assert.equal(result.dispute.financeSettlement.workerSettlementAmount, 1500);
  assert.equal((await User.findById(data.worker._id)).workerBalance, 2500);
});

test('scenario 5: a duplicate active dispute is blocked and identifies the existing ticket', async () => {
  const data = await fixture();
  const existing = await open({ ...data, disputedAmount: 2500 });
  const duplicate = response();
  await openPaymentDispute({ params: { applicationId: String(data.application._id) }, user: { id: String(data.worker._id), role: 'work' }, body: { reason: 'Duplicate claim', disputedAmount: 2500 } }, duplicate);
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.payload.message, 'An active financial dispute already exists for this job.');
  assert.equal(String(duplicate.payload.existingDisputeId), String(existing._id));
  assert.equal((await FinancialDispute.countDocuments({ application: data.application._id, active: true })), 1);
  assert.ok(existing.ticketId.startsWith('FIN-'));
});

const assertPermissionDenied = (user, permission) => {
  const res = response();
  let called = false;
  requirePermission(permission)({ user }, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
};

test('scenario 6: employer cannot modify a Finance decision', async () => {
  assertPermissionDenied({ role: 'hire' }, 'finance.disputes.review');
});

test('scenario 7: Support staff cannot propose or process a settlement', async () => {
  assertPermissionDenied({ role: 'admin', staffRole: 'support_staff' }, 'finance.disputes.review');
  assertPermissionDenied({ role: 'admin', staffRole: 'support_staff' }, 'finance.disputes.approve');
});

test('scenario 8: Finance cannot settle before Support completes the investigation report', async () => {
  const data = await fixture();
  const dispute = await open({ ...data, disputedAmount: 2500 });
  await assert.rejects(
    proposeDisputeSettlement({ disputeId: dispute._id, financeUserId: data.finance._id, settlementType: 'COMPLETE_PAYMENT', decisionReason: 'Premature.' }),
    /before the investigation report is completed/i,
  );
});

test('scenario 9: partial settlement cannot exceed available held funds', async () => {
  const data = await fixture();
  const dispute = await completeReport(await open({ ...data, disputedAmount: 2500 }), data.support);
  await assert.rejects(
    proposeDisputeSettlement({ disputeId: dispute._id, financeUserId: data.finance._id, settlementType: 'PARTIAL_PAYMENT', workerAmount: 2000, employerRefund: 1000, decisionReason: 'Invalid over-allocation.' }),
    /cannot exceed the available held dispute funds/i,
  );
});

test('scenario 10: processing an approved settlement twice is idempotent', async () => {
  const data = await fixture();
  const dispute = await completeReport(await open({ ...data, disputedAmount: 2500 }), data.support);
  await proposeDisputeSettlement({ disputeId: dispute._id, financeUserId: data.finance._id, settlementType: 'COMPLETE_PAYMENT', decisionReason: 'Full completion confirmed.' });
  assert.equal((await Job.findById(data.job._id)).status, 'Available');
  const first = await approveAndProcessDisputeSettlement({ disputeId: dispute._id, approverId: data.approver._id });
  const second = await approveAndProcessDisputeSettlement({ disputeId: dispute._id, approverId: data.approver._id });
  assert.equal(first.deduplicated, false);
  assert.equal(second.deduplicated, true);
  assert.equal(await Transaction.countDocuments({ reference: `financial-dispute:${dispute._id}:${first.dispute.financeSettlement.settlementId}:worker` }), 1);
  assert.equal((await User.findById(data.worker._id)).workerBalance, 2500);
});

test('finance proposal requires a different approver', async () => {
  const data = await fixture();
  const dispute = await completeReport(await open({ ...data, disputedAmount: 2500 }), data.support);
  await proposeDisputeSettlement({ disputeId: dispute._id, financeUserId: data.finance._id, settlementType: 'COMPLETE_PAYMENT', decisionReason: 'Full completion confirmed.' });
  await assert.rejects(
    approveAndProcessDisputeSettlement({ disputeId: dispute._id, approverId: data.finance._id }),
    /different authorized finance user/i,
  );
});

test('only the assigned worker can submit a financial dispute', async () => {
  const data = await fixture();
  const employerAttempt = response();
  await openPaymentDispute({ params: { applicationId: String(data.application._id) }, user: { id: String(data.employer._id), role: 'hire' }, body: { reason: 'Employer attempt', disputedAmount: 2500 } }, employerAttempt);
  assert.equal(employerAttempt.statusCode, 403);
});

test('a single appeal preserves the original decision and can return through investigation', async () => {
  const data = await fixture();
  let dispute = await open({ ...data, disputedAmount: 2500 });
  const first = await settle({ ...data, dispute, settlementType: 'FULL_REFUND' });
  const firstSettlementId = first.dispute.financeSettlement.settlementId;
  const appealResponse = response();
  await submitFinancialDisputeAppeal({
    params: { disputeId: String(dispute._id) },
    user: { id: String(data.worker._id), role: 'work' },
    body: { reason: 'New evidence should be reviewed.' },
  }, appealResponse);
  assert.equal(appealResponse.statusCode, 200, JSON.stringify(appealResponse.payload));
  assert.equal(appealResponse.payload.dispute.investigationReportHistory[0].supportNotes, undefined);
  dispute = await FinancialDispute.findById(dispute._id);
  assert.equal(dispute.investigationStatus, 'UNDER_APPEAL');
  assert.equal(dispute.settlementHistory.length, 1);
  assert.equal(dispute.settlementHistory[0].settlementId, firstSettlementId);
  assert.equal(dispute.financeSettlement, null);
  assert.equal((await JobApplication.findById(data.application._id)).paymentStatus, 'Disputed');
  await completeReport(dispute, data.support);
  const reproposed = await proposeDisputeSettlement({
    disputeId: dispute._id,
    financeUserId: data.finance._id,
    settlementType: 'COMPLETE_PAYMENT',
    decisionReason: 'Appeal evidence reviewed; any unavailable platform funds are recorded as outstanding.',
  });
  assert.notEqual(reproposed.financeSettlement.settlementId, firstSettlementId);

  const duplicateAppeal = response();
  await submitFinancialDisputeAppeal({
    params: { disputeId: String(dispute._id) },
    user: { id: String(data.worker._id), role: 'work' },
    body: { reason: 'Second appeal.' },
  }, duplicateAppeal);
  assert.equal(duplicateAppeal.statusCode, 409);
});


test('worker payment dispute notifies the employer immediately with the specific job and case', async () => {
  const data = await fixture();
  const dispute = await open({ ...data, disputedAmount: 2500 });
  const notice = await Notification.findOne({ deliveryKey: `dispute:${dispute._id}:${data.employer._id}` });
  assert.ok(notice);
  assert.equal(notice.audience, 'employer');
  assert.equal(notice.metadata.jobId, String(data.job._id));
  assert.equal(notice.entityType, 'financial_dispute');
  assert.equal(notice.link, `/employer/financial-disputes?disputeId=${dispute._id}`);
  assert.equal(await NotificationOutbox.countDocuments({ key: notice.deliveryKey, status: 'delivered' }), 1);
});
