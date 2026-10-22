import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import JobOffer from '../../models/JobOffer.js';
import User from '../../models/User.js';
import Transaction from '../../models/Transaction.js';
import NotificationOutbox from '../../models/NotificationOutbox.js';
import Notification from '../../models/Notification.js';
import { runMaintenance } from '../../services/maintenance.js';
import { createJobOffer, respondToJobOffer, cancelJobOffer, confirmOfferHire } from '../../controllers/JobOfferController.js';
import { expireOffer, maintainJobOffers } from '../../services/offerLifecycle.js';
import { offerDeadline } from '../../lib/offerPolicy.js';
import { HOUR } from '../../lib/lifecyclePolicy.js';
import { remainingJobFunds } from '../../services/jobFunds.js';
import { offerResponseStatus as webStatus } from '../../../client/src/lib/offerResponse.ts';
import { offerResponseStatus as mobileStatus } from '../../../Mobile/lib/offerResponse.ts';

let mongo;
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const request = (user, offerId, body = {}) => ({ user: { id: String(user._id) }, params: { offerId }, body });
const settings = ['OFFER_RESPONSE_HOURS', 'OFFER_REMINDER_BEFORE_HOURS'];
let previous;
before(async () => {
  previous = Object.fromEntries(settings.map((key) => [key, process.env[key]]));
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: 'offer-lifecycle' });
  await Promise.all([Transaction.init(), JobOffer.init(), NotificationOutbox.init()]);
});
beforeEach(async () => { for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({}); for (const key of settings) delete process.env[key]; });
after(async () => { for (const key of settings) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } await mongoose.disconnect(); await mongo.stop(); });

async function fixture(jobOverrides = {}) {
  const [employer, worker] = await Promise.all(['hire', 'work'].map((role) => User.create({ email: `${new mongoose.Types.ObjectId()}@example.test`, firstName: 'Test', lastName: role, role, status: 'active', employerBalance: role === 'hire' ? 1000 : 0, passwordHashed: 'unused' })));
  const job = await Job.create({ title: 'Offer test', description: 'Work', location: 'Pasig', salary: 500, jobType: 'Short-term', status: 'Available', deadline: new Date(Date.now() + 7 * 24 * HOUR), jobPoster: employer._id, ...jobOverrides });
  const application = await JobApplication.create({ job: job._id, applicant: worker._id, status: 'Shortlisted' });
  const base = Number(job.salary) * (job.paymentMode === 'daily' ? job.workDates.length : 1);
  await Transaction.create({ sender: employer._id, amount: base, type: 'ESCROW', status: 'COMPLETED', balanceTarget: 'ESCROW', jobReference: job._id, meta: { fundingSources: { EMPLOYER: base, WORKER: 0 } } });
  const res = response();
  await createJobOffer({ user: { id: String(employer._id) }, params: { applicationId: application._id }, body: { amount: 600 } }, res);
  assert.equal(res.statusCode, 201, res.body.message);
  return { employer, worker, job, application, offer: await JobOffer.findById(res.body.offer.id) };
}

test('response timing is configurable, capped by the posting deadline, and rejects invalid settings', () => {
  const now = new Date('2026-10-19T00:00:00Z'); const job = { deadline: new Date(now.getTime() + 96 * HOUR) };
  let timing = offerDeadline(job, now);
  assert.equal(timing.expiresAt.getTime(), now.getTime() + 48 * HOUR);
  assert.equal(timing.responseReminderAt.getTime(), now.getTime() + 24 * HOUR);
  process.env.OFFER_RESPONSE_HOURS = '12'; process.env.OFFER_REMINDER_BEFORE_HOURS = '2';
  timing = offerDeadline(job, now); assert.equal(timing.expiresAt.getTime(), now.getTime() + 12 * HOUR); assert.equal(timing.responseReminderAt.getTime(), now.getTime() + 10 * HOUR);
  timing = offerDeadline({ deadline: new Date(now.getTime() + HOUR) }, now);
  assert.equal(timing.responseReminderAt.getTime(), now.getTime() + HOUR / 2);
  process.env.OFFER_REMINDER_BEFORE_HOURS = '0'; assert.equal(offerDeadline(job, now).responseReminderAt, null);
  for (const invalid of ['0', '-1', 'bad', 'Infinity']) { process.env.OFFER_RESPONSE_HOURS = invalid; assert.throws(() => offerDeadline(job, now), { status: 503 }); }
});

test('expiry returns only the negotiated increase, releases the seat once, and preserves the application and base funding', async () => {
  const f = await fixture();
  assert.equal((await User.findById(f.employer._id)).employerBalance, 900);
  const before = new Date(f.offer.expiresAt.getTime() - 1); assert.equal(await expireOffer(f.offer._id, before), false);
  const results = await Promise.all([expireOffer(f.offer._id, f.offer.expiresAt), expireOffer(f.offer._id, f.offer.expiresAt)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal((await JobOffer.findById(f.offer._id)).status, 'expired');
  assert.equal((await User.findById(f.employer._id)).employerBalance, 1000);
  assert.equal((await remainingJobFunds(f.job._id)).remaining, 500);
  assert.equal(await Transaction.countDocuments({ reference: `offer-extra-refund:${f.offer._id}` }), 1);
  const job = await Job.findById(f.job._id); assert.equal(job.reservedOfferCount, 0); assert.equal(job.status, 'Available');
  const application = await JobApplication.findById(f.application._id); assert.equal(application.status, 'Shortlisted'); assert.ok(application.timeline.some((event) => event.type === 'offer_expired'));
  assert.equal(await NotificationOutbox.countDocuments({ key: { $regex: '^offer-expired:' } }), 2);
});

test('reminders are repeat-safe, target the worker, and stop once the offer is accepted', async () => {
  const f = await fixture();
  assert.equal((await maintainJobOffers({ now: new Date(f.offer.responseReminderAt.getTime() - 1) })).reminders, 0);
  const runs = await Promise.all([maintainJobOffers({ now: f.offer.responseReminderAt }), maintainJobOffers({ now: f.offer.responseReminderAt })]);
  assert.equal(runs.reduce((sum, result) => sum + result.reminders, 0), 1);
  const reminder = await NotificationOutbox.findOne({ key: `offer-response-reminder:${f.offer._id}` });
  assert.equal(reminder.payload.userId, String(f.worker._id)); assert.equal(reminder.payload.audience, 'worker'); assert.match(reminder.payload.message, /Asia\/Manila/);
  const accepted = response(); await respondToJobOffer(request(f.worker, f.offer._id, { action: 'accept', policyAcknowledged: true }), accepted); assert.equal(accepted.statusCode, 200);
  const later = await maintainJobOffers({ now: new Date(f.offer.expiresAt.getTime() + HOUR) }); assert.equal(later.reminders, 0); assert.equal(later.expired, 0);
  assert.equal((await Job.findById(f.job._id)).reservedOfferCount, 1);
  const hired = response(); await confirmOfferHire(request(f.employer, f.offer._id), hired); assert.equal(hired.statusCode, 200);
  assert.equal(await expireOffer(f.offer._id, new Date(f.offer.expiresAt.getTime() + HOUR)), false);
});

test('accepting an overdue offer fails and safely expires it even before scheduled maintenance', async () => {
  const f = await fixture(); await JobOffer.updateOne({ _id: f.offer._id }, { $set: { expiresAt: new Date(Date.now() - 1) } });
  const wrongParty = response(); await respondToJobOffer(request(f.employer, f.offer._id, { action: 'accept', policyAcknowledged: true }), wrongParty); assert.equal(wrongParty.statusCode, 404);
  assert.equal((await JobOffer.findById(f.offer._id)).status, 'pending');
  const expired = response(); await respondToJobOffer(request(f.worker, f.offer._id, { action: 'accept', policyAcknowledged: true }), expired); assert.equal(expired.statusCode, 409);
  assert.equal((await JobOffer.findById(f.offer._id)).status, 'expired'); assert.equal((await Job.findById(f.job._id)).reservedOfferCount, 0);
  const hired = response(); await confirmOfferHire(request(f.employer, f.offer._id), hired); assert.equal(hired.statusCode, 404);
});

test('acceptance racing expiry cannot leave an accepted offer with a released reservation', async () => {
  const f = await fixture(); const accepted = response();
  await Promise.all([respondToJobOffer(request(f.worker, f.offer._id, { action: 'accept', policyAcknowledged: true }), accepted), expireOffer(f.offer._id, f.offer.expiresAt)]);
  const offer = await JobOffer.findById(f.offer._id); const job = await Job.findById(f.job._id);
  assert.ok(['accepted', 'expired'].includes(offer.status));
  assert.equal(job.reservedOfferCount, offer.status === 'accepted' ? 1 : 0);
  assert.equal((await User.findById(f.employer._id)).employerBalance, offer.status === 'accepted' ? 900 : 1000);
});

test('cancellation racing expiry cannot refund the extra amount twice', async () => {
  const f = await fixture(); const canceled = response();
  await Promise.all([cancelJobOffer(request(f.employer, f.offer._id, { reason: 'No longer needed', policyAcknowledged: true }), canceled), expireOffer(f.offer._id, f.offer.expiresAt)]);
  assert.ok(['cancelled', 'expired'].includes((await JobOffer.findById(f.offer._id)).status));
  assert.equal((await Job.findById(f.job._id)).reservedOfferCount, 0); assert.equal((await User.findById(f.employer._id)).employerBalance, 1000);
  assert.equal(await Transaction.countDocuments({ reference: `offer-extra-refund:${f.offer._id}` }), 1);
});

test('manual recruitment closure is preserved and held or inconsistent funds are not released', async () => {
  const f = await fixture(); await Job.updateOne({ _id: f.job._id }, { $set: { closedManually: true, cancellationPending: true } });
  assert.equal(await expireOffer(f.offer._id, f.offer.expiresAt), false);
  await Job.updateOne({ _id: f.job._id }, { $set: { cancellationPending: false } });
  await Transaction.deleteOne({ reference: `offer-extra:${f.offer._id}` });
  const failed = await maintainJobOffers({ now: f.offer.expiresAt }); assert.equal(failed.errors, 1); assert.equal(failed.expired, 0);
  assert.equal((await JobOffer.findById(f.offer._id)).status, 'pending'); assert.equal((await Job.findById(f.job._id)).reservedOfferCount, 1);
  await Transaction.create({ sender: f.employer._id, amount: 100, type: 'ESCROW', status: 'COMPLETED', balanceTarget: 'ESCROW', jobReference: f.job._id, meta: { fundingSources: { EMPLOYER: 100, WORKER: 0 } } });
  assert.equal(await expireOffer(f.offer._id, f.offer.expiresAt), true); assert.equal((await Job.findById(f.job._id)).status, 'Closed');
});

test('legacy pending offers without a deadline keep their existing terms', async () => {
  const f = await fixture(); await JobOffer.updateOne({ _id: f.offer._id }, { $set: { expiresAt: null, responseReminderAt: null } });
  const result = await maintainJobOffers({ now: new Date(Date.now() + 365 * 24 * HOUR) });
  assert.deepEqual(result, { expired: 0, reminders: 0, errors: 0 }); assert.equal((await JobOffer.findById(f.offer._id)).status, 'pending');
});

test('daily-offer expiry refunds only the negotiated increase across all scheduled dates', async () => {
  const dates = [1, 2].map((days) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + days * 24 * HOUR)));
  const f = await fixture({ jobType: 'Recruiting', paymentMode: 'daily', salary: 480, workDates: dates });
  assert.equal((await User.findById(f.employer._id)).employerBalance, 760);
  assert.equal(await expireOffer(f.offer._id, f.offer.expiresAt), true);
  assert.equal((await User.findById(f.employer._id)).employerBalance, 1000);
  assert.equal((await remainingJobFunds(f.job._id)).remaining, 960);
  assert.equal((await Transaction.findOne({ reference: `offer-extra-refund:${f.offer._id}` })).amount, 240);
});

test('invalid offer timing rolls back reservations and funding when sending a replacement offer', async () => {
  const f = await fixture(); await expireOffer(f.offer._id, f.offer.expiresAt);
  process.env.OFFER_RESPONSE_HOURS = 'invalid';
  const res = response();
  await createJobOffer({ user: { id: String(f.employer._id) }, params: { applicationId: f.application._id }, body: { amount: 650 } }, res);
  assert.equal(res.statusCode, 503); assert.equal((await User.findById(f.employer._id)).employerBalance, 1000);
  assert.equal((await Job.findById(f.job._id)).reservedOfferCount, 0);
  assert.equal(await JobOffer.countDocuments(), 1);
});

test('scheduled maintenance expires and delivers offer notices to both parties', async () => {
  const f = await fixture(); await JobOffer.updateOne({ _id: f.offer._id }, { $set: { expiresAt: new Date(Date.now() - 1) } });
  const result = await runMaintenance(); assert.equal(result.offers.expired, 1); assert.equal(result.offers.errors, 0);
  assert.equal(await Notification.countDocuments({ deliveryKey: { $regex: '^offer-expired:' } }), 2);
  assert.equal((await runMaintenance()).offers.expired, 0);
});

test('web and mobile agree on deadline boundaries and never expire accepted or legacy offers', () => {
  const expiresAt = new Date('2026-10-20T00:00:00Z');
  for (const status of [webStatus, mobileStatus]) {
    assert.equal(status({ status: 'pending', expiresAt: expiresAt.toISOString() }, expiresAt.getTime() - 1), 'pending');
    assert.equal(status({ status: 'pending', expiresAt: expiresAt.toISOString() }, expiresAt.getTime()), 'expired');
    assert.equal(status({ status: 'accepted', expiresAt: expiresAt.toISOString() }, expiresAt.getTime()), 'accepted');
    assert.equal(status({ status: 'pending' }), 'pending');
  }
});
