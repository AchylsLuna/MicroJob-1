import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import JobApplication from '../models/JobApplication.js';
import JobOffer from '../models/JobOffer.js';
import { httpError, money } from '../lib/lifecyclePolicy.js';
import { baseWorkerPay } from '../lib/dailyWorkPolicy.js';

export async function remainingJobFunds(jobId, session) {
  const rows = await Transaction.aggregate([
    { $match: { jobReference: jobId, status: 'COMPLETED', type: { $in: ['ESCROW', 'PAYOUT', 'REFUND'] } } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]).session(session || null);
  const totals = Object.fromEntries(rows.map((row) => [row._id, money(row.total)]));
  return { secured: totals.ESCROW || 0, paid: totals.PAYOUT || 0, refunded: totals.REFUND || 0, remaining: money((totals.ESCROW || 0) - (totals.PAYOUT || 0) - (totals.REFUND || 0)) };
}

export async function requiredJobFunds(job, session) {
  const hires = await JobApplication.find({ job: job._id, status: { $in: ['Hired', 'Accepted'] } }).select('agreedAmount paidAmount paymentStatus').session(session || null);
  const offers = await JobOffer.find({ job: job._id, status: { $in: ['pending', 'accepted'] } }).select('additionalEscrow').session(session || null);
  const vacantBase = Math.max(0, Number(job.positionsNeeded || 1) - hires.length) * baseWorkerPay(job);
  return money(vacantBase + hires.filter((app) => app.paymentStatus !== 'Paid').reduce((total, app) => total + Math.max(0, Number(app.agreedAmount || baseWorkerPay(job)) - Number(app.paidAmount || 0)), 0) + offers.reduce((total, offer) => total + Number(offer.additionalEscrow || 0), 0));
}

/** Replay completed ledger entries so job refunds keep their original wallet. */
export async function remainingJobWalletSources(job, session) {
  const rows = await Transaction.find({ jobReference: job._id, status: 'COMPLETED', type: { $in: ['ESCROW', 'PAYOUT', 'REFUND'] } }).sort({ createdAt: 1, _id: 1 }).session(session || null);
  const balances = { EMPLOYER: 0, WORKER: 0 };
  let owner; const legacySpending = [];
  for (const row of rows) {
    let sources = row.meta?.fundingSources;
    if (!sources && row.type === 'ESCROW') {
      owner ||= await User.findById(job.jobPoster).select('role').session(session || null);
      if (owner?.role === 'both') throw httpError(409, 'Legacy job funding sources require Finance reconciliation before funds can move.');
      sources = { EMPLOYER: row.amount, WORKER: 0 };
    }
    if (!sources && row.type === 'REFUND') sources = { [row.balanceTarget === 'WORKER' ? 'WORKER' : 'EMPLOYER']: row.amount };
    if (!sources) { legacySpending.push(row.amount); continue; }
    if (money(Number(sources.EMPLOYER || 0) + Number(sources.WORKER || 0)) !== money(row.amount)) throw httpError(409, 'Job funding sources require reconciliation.');
    for (const wallet of ['EMPLOYER', 'WORKER']) balances[wallet] = money(balances[wallet] + (row.type === 'ESCROW' ? 1 : -1) * Number(sources[wallet] || 0));
  }
  if (balances.EMPLOYER < 0 || balances.WORKER < 0) throw httpError(409, 'Job funding sources require reconciliation.');
  for (const amount of legacySpending) { const sources = allocateSources(balances, amount); for (const wallet of ['EMPLOYER', 'WORKER']) balances[wallet] = money(balances[wallet] - sources[wallet]); }
  return balances;
}
function allocateSources(balances, amount, preferredWallet) {
  const sources = { EMPLOYER: 0, WORKER: 0 };
  if (preferredWallet) {
    if (balances[preferredWallet] < amount) throw httpError(409, 'The original job funding wallet requires reconciliation.');
    sources[preferredWallet] = amount;
  } else {
    // Spend worker funding first, preserving employer funding for offer increases.
    sources.WORKER = money(Math.min(balances.WORKER, amount));
    sources.EMPLOYER = money(amount - sources.WORKER);
    if (sources.EMPLOYER > balances.EMPLOYER) throw httpError(409, 'Insufficient secured funds.');
  }
  return sources;
}
export async function jobSpendingSources(job, amount, session, preferredWallet) {
  return allocateSources(await remainingJobWalletSources(job, session), amount, preferredWallet);
}
export async function refundJobFunds({ job, amount, reference, actor, application, session, preferredWallet }) {
  if (amount <= 0) return null;
  const existing = await Transaction.findOne({ reference }).session(session);
  if (existing) return existing;
  const fundingSources = await jobSpendingSources(job, amount, session, preferredWallet);
  const result = await User.updateOne({ _id: job.jobPoster }, { $inc: { employerBalance: fundingSources.EMPLOYER, workerBalance: fundingSources.WORKER } }, { session });
  if (!result.matchedCount) throw httpError(409, 'Employer account is unavailable.');
  const [entry] = await Transaction.create([{ receiver: job.jobPoster, amount, type: 'REFUND', status: 'COMPLETED', balanceTarget: fundingSources.WORKER === amount ? 'WORKER' : fundingSources.EMPLOYER === amount ? 'EMPLOYER' : 'SYSTEM', meta: { fundingSources }, jobReference: job._id, reference, actor, relatedEntityType: application ? 'job_application' : 'job', relatedEntityId: String(application || job._id), label: 'Unused job funds returned to original wallet' }], { session });
  return entry;
}
