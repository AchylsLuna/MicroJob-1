import 'dotenv/config';
import mongoose from 'mongoose';
import Job from '../models/Job.js';
import User from '../models/User.js';
import JobApplication from '../models/JobApplication.js';
import JobOffer from '../models/JobOffer.js';
import PayoutRequest from '../models/PayoutRequest.js';
import Cancellation from '../models/Cancellation.js';
import { remainingJobFunds, remainingJobWalletSources } from '../services/jobFunds.js';

/** No writes without --apply. Run against a backup first; ambiguous money is never repaired automatically. */
export async function migrateLifecycle({ apply = false } = {}) {
  const report = { apply, jobs: 0, legacyHires: 0, legacyWithdrawals: 0, legacyLocks: 0, counterDifferences: [], jobPhaseDifferences: [], missingCancellationReasons: [], orphanedApplications: [], ambiguousFunds: [] };
  for await (const job of Job.find().cursor()) {
    report.jobs += 1;
    const [hires, offers, funds] = await Promise.all([
      JobApplication.countDocuments({ job: job._id, status: { $in: ['Hired', 'Accepted'] } }),
      JobOffer.countDocuments({ job: job._id, status: { $in: ['pending', 'accepted'] } }), remainingJobFunds(job._id),
    ]);
    if (hires !== job.hiredCount || offers !== job.reservedOfferCount) {
      report.counterDifferences.push({ job: String(job._id), hires, offers });
      if (apply) await Job.updateOne({ _id: job._id }, { $set: { hiredCount: hires, reservedOfferCount: offers } });
    }
    if (hires > 0 && !job.cancellationPending && ['Available', 'Closed'].includes(job.status)) {
      report.jobPhaseDifferences.push({ job: String(job._id), previousStatus: job.status, status: 'In Progress' });
      if (apply) await Job.updateOne({ _id: job._id }, { $set: { status: 'In Progress' } });
    }
    try { await remainingJobWalletSources(job); } catch (error) { report.ambiguousFunds.push({ job: String(job._id), reason: error.message }); }
    if (funds.remaining < 0 || (hires > 0 && funds.secured === 0)) report.ambiguousFunds.push({ job: String(job._id), ...funds });
    if (job.status === 'Cancelled' && !await Cancellation.exists({ job: job._id, scope: 'job' })) {
      report.missingCancellationReasons.push(String(job._id));
      if (apply) {
        await Cancellation.create({ job: job._id, actor: null, legacy: true, scope: 'job', reason: job.cancellationReason || 'Not recorded', status: 'resolved', occurredAt: job.cancelledAt || null, events: [{ type: 'legacy_record_imported', note: 'Original cancellation actor, date, and reason may not have been recorded. No financial changes made.' }] });
        await Job.updateOne({ _id: job._id }, { $set: { cancellationReason: job.cancellationReason || 'Not recorded' } });
      }
    }
  }
  for await (const app of JobApplication.find().cursor()) {
    if (!await Job.exists({ _id: app.job })) { report.orphanedApplications.push(String(app._id)); continue; }
    if (['Hired', 'Accepted'].includes(app.status) && !app.startedAt && app.workStatus !== 'Not started' && !app.timeline?.some((event) => event.type === 'legacy_start_state')) {
      report.legacyHires += 1;
      // Do not invent a start date. The legacy In Progress state conservatively
      // disallows pre-start cancellation and is retained as the source evidence.
      if (apply) await JobApplication.updateOne({ _id: app._id }, { $set: { ...(app.workSubmittedAt && !app.firstSubmittedAt ? { firstSubmittedAt: app.workSubmittedAt } : {}), status: 'Hired' }, $push: { timeline: { type: 'legacy_start_state', note: 'Legacy assignment treated as started; exact start date not recorded.', createdAt: new Date() } } });
    }
  }
  const legacyFilter = { $or: [{ sourceWallet: { $exists: false } }, { processingMode: { $exists: false } }] };
  report.legacyWithdrawals = await PayoutRequest.countDocuments(legacyFilter);
  if (apply) {
    await PayoutRequest.updateMany({ sourceWallet: { $exists: false }, balanceTarget: 'EMPLOYER' }, { $set: { sourceWallet: 'EMPLOYER' } });
    await PayoutRequest.updateMany({ sourceWallet: { $exists: false } }, { $set: { sourceWallet: 'WORKER' } });
    await PayoutRequest.updateMany({ processingMode: { $exists: false } }, { $set: { processingMode: 'manual' } });
  }
  const maximumLock = new Date(Date.now() + 180000);
  report.legacyLocks = await User.countDocuments({ lockUntil: { $gt: maximumLock } });
  if (apply) await User.updateMany({ lockUntil: { $gt: maximumLock } }, { $set: { lockUntil: maximumLock } });
  return report;
}
if (process.argv[1]?.replace(/\\/g, '/')?.endsWith('/migrateLifecycle.js')) {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  try { await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME || 'MicroJob' }); console.log(JSON.stringify(await migrateLifecycle({ apply: process.argv.includes('--apply') }), null, 2)); }
  finally { await mongoose.disconnect(); }
}
