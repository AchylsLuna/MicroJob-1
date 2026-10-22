import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import JobOffer from '../../models/JobOffer.js';
import User from '../../models/User.js';
import Transaction from '../../models/Transaction.js';
import Review from '../../models/Review.js';
import { confirmOfferHire } from '../../controllers/JobOfferController.js';
import { deleteJob, getMyJobs, getEmployerJobHistory } from '../../controllers/JobController.js';
import { createReview } from '../../controllers/ReviewController.js';
import { requestCancellation } from '../../services/jobLifecycle.js';
import { encodePublicId } from '../../lib/publicId.js';

let mongo;
const response = () => ({ statusCode: 200, payload: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } });
const request = (employer, job) => ({ user: { id: String(employer._id), role: 'hire' }, params: { id: encodePublicId(job._id) } });
const user = async (role) => {
  const doc = new User({ email: `${new mongoose.Types.ObjectId()}@example.com`, firstName: 'History', lastName: 'User', role, status: 'active' });
  await doc.setPassword('Password123!');
  return doc.save();
};
async function fixture(positionsNeeded = 1) {
  const employer = await user('hire');
  const worker = await user('work');
  const job = await Job.create({ title: 'Cleanup', description: 'Clean the park', location: 'Pasig', salary: 500, jobType: 'Short-term', deadline: new Date('2027-01-01'), jobPoster: employer._id, positionsNeeded, reservedOfferCount: 1 });
  const application = await JobApplication.create({ job: job._id, applicant: worker._id, status: 'Offer Sent', coverLetter: 'Ready to help', employerHidden: true });
  const offer = await JobOffer.create({ job: job._id, application: application._id, employer: employer._id, worker: worker._id, amount: 600, additionalEscrow: 100, status: 'accepted' });
  await Transaction.create({ sender: employer._id, amount: 500 * positionsNeeded + 100, type: 'ESCROW', status: 'COMPLETED', balanceTarget: 'ESCROW', jobReference: job._id });
  return { employer, worker, job, application, offer };
}
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: 'employer-job-history' });
  await Promise.all([Transaction.init(), Review.init()]);
});
beforeEach(async () => { await Promise.all([Job, JobApplication, JobOffer, User, Transaction, Review].map((model) => model.deleteMany({}))); });
after(async () => { await mongoose.disconnect(); await mongo?.stop(); });

for (const positions of [1, 2]) {
  test(`confirmed hire reserves a not-started assignment with ${positions} position(s) and blocks deletion without moving escrow`, async () => {
    const { employer, job, offer, application } = await fixture(positions);
    const hired = response();
    await confirmOfferHire({ user: { id: String(employer._id) }, params: { offerId: String(offer._id) } }, hired);
    assert.equal(hired.statusCode, 200);
    const saved = await Job.findById(job._id);
    assert.equal(saved.status, 'In Progress');
    assert.equal((await JobApplication.findById(application._id)).workStatus, 'Not started');
    assert.equal(saved.hiredCount, 1);
    assert.ok(saved.hireConfirmedAt);
    const rejected = response();
    await deleteJob(request(employer, job), rejected);
    assert.equal(rejected.statusCode, 409);
    assert.equal(rejected.payload.code, 'JOB_HIRE_CONFIRMED');
    assert.ok(await JobApplication.findById(application._id));
    assert.ok(await JobOffer.findById(offer._id));
    assert.equal(await Transaction.countDocuments({ type: 'REFUND' }), 0);
    const owned = response();
    await getMyJobs(request(employer, job), owned);
    assert.equal(owned.payload[0].canDelete, false);
  });
}

test('history uses completed ledger entries, excludes fees, and scopes to the owner', async () => {
  const { employer, worker, job } = await fixture(2);
  await fixture(); // another employer must remain invisible
  await Transaction.create([
    { amount: 300, type: 'PAYOUT', status: 'COMPLETED', balanceTarget: 'WORKER', receiver: worker._id, jobReference: job._id },
    { amount: 100, type: 'REFUND', status: 'COMPLETED', balanceTarget: 'EMPLOYER', receiver: employer._id, jobReference: job._id },
    { amount: 70, type: 'POSTING_FEE', status: 'COMPLETED', sender: employer._id, jobReference: job._id },
    { amount: 200, type: 'PAYOUT', status: 'PENDING', receiver: worker._id, jobReference: job._id },
  ]);
  const history = response();
  await getEmployerJobHistory(request(employer, job), history);
  assert.equal(history.payload.length, 1);
  assert.equal(history.payload[0]._id, encodePublicId(job._id));
  assert.equal(history.payload[0].amountHeld, 700);
  assert.equal(history.payload[0].amountPaid, 300);
  assert.equal(history.payload[0].description, 'Clean the park');
});

test('old hires and ended assignments remain locked even without a hire counter', async () => {
  const { employer, job, application } = await fixture();
  await JobApplication.updateOne({ _id: application._id }, { $set: { status: 'Rejected', hiredAt: new Date() } });
  await Job.updateOne({ _id: job._id }, { $set: { status: 'Completed', hiredCount: 0 } });
  const rejected = response();
  await deleteJob(request(employer, job), rejected);
  assert.equal(rejected.statusCode, 200);
  assert.ok((await Job.findById(job._id)).archivedAt);
  const owned = response();
  await getMyJobs(request(employer, job), owned);
  assert.equal(owned.payload[0].canDelete, false);
});

test('cancelling then archiving refunds escrow and retains dependencies', async () => {
  const { employer, job, offer, application } = await fixture();
  await requestCancellation({ jobId: job._id, actor: employer._id, reason: 'No longer required', policyAcknowledged: true });
  const deleted = response();
  await deleteJob(request(employer, job), deleted);
  assert.equal(deleted.statusCode, 200);
  assert.ok((await Job.findById(job._id)).archivedAt);
  assert.equal((await JobOffer.findById(offer._id)).status, 'cancelled');
  assert.ok(await JobApplication.findById(application._id));
  assert.equal((await User.findById(employer._id)).employerBalance, 600);
});

test('a concurrent hire and deletion cannot both succeed', async () => {
  const { employer, job, offer } = await fixture();
  const hired = response(); const deleted = response();
  await Promise.all([
    confirmOfferHire({ user: { id: String(employer._id) }, params: { offerId: String(offer._id) } }, hired),
    deleteJob(request(employer, job), deleted),
  ]);
  assert.equal([hired, deleted].filter((result) => result.statusCode === 200).length, 1);
  if (hired.statusCode === 200) {
    assert.equal(deleted.statusCode, 409);
    assert.equal((await Job.findById(job._id)).status, 'In Progress');
    assert.equal(await Transaction.countDocuments({ type: 'REFUND' }), 0);
  } else {
    assert.equal(await Job.findById(job._id), null);
    assert.equal(await Transaction.countDocuments({ type: 'REFUND' }), 1);
  }
});

test('employer ratings require completion and prevent duplicate reviews', async () => {
  const { employer, job, application } = await fixture();
  await JobApplication.updateOne({ _id: application._id }, { $set: { status: 'Hired' } });
  await Job.updateOne({ _id: job._id }, { $set: { status: 'In Progress' } });
  const reviewReq = { user: { id: String(employer._id) }, body: { applicationId: String(application._id), rating: 5, comment: 'Great work' } };
  const blocked = response(); await createReview(reviewReq, blocked);
  assert.equal(blocked.statusCode, 403);
  await Job.updateOne({ _id: job._id }, { $set: { status: 'Completed' } });
  const created = response(); await createReview(reviewReq, created);
  assert.equal(created.statusCode, 201);
  const duplicate = response(); await createReview(reviewReq, duplicate);
  assert.equal(duplicate.statusCode, 409);
  assert.equal(await Review.countDocuments({ application: application._id }), 1);
});
