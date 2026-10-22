import Transaction from '../models/Transaction.js';

export const toCents = (amount) => Math.round(Number(amount || 0) * 100);
export const fromCents = (amount) => Number((Number(amount || 0) / 100).toFixed(2));

export function parseMoney(value, fieldName, { allowZero = true } = {}) {
  const amount = Number(value);
  const cents = toCents(amount);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(cents)
    || (!allowZero && cents <= 0) || (allowZero && cents < 0)
    || Math.abs(amount * 100 - cents) > 1e-7) {
    const qualifier = allowZero ? 'a non-negative amount' : 'an amount greater than zero';
    throw Object.assign(new Error(`${fieldName} must be ${qualifier} with at most two decimal places.`), { status: 400 });
  }
  return cents;
}

const aggregateTotal = async (match, session) => {
  const query = Transaction.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  if (session) query.session(session);
  const result = await query;
  return Number(result[0]?.total || 0);
};

export async function getDisputeMoneySnapshot({ application, job, session = null }) {
  const applicationId = String(application._id);
  const [alreadyPaid, escrowed, jobPayouts, jobRefunds] = await Promise.all([
    aggregateTotal({
      jobReference: job._id,
      receiver: application.applicant,
      type: 'PAYOUT',
      status: 'COMPLETED',
      $or: [
        { relatedEntityType: 'job_application', relatedEntityId: applicationId },
        { reference: `application-payout:${applicationId}` },
        { 'meta.applicationId': applicationId },
      ],
    }, session),
    aggregateTotal({ jobReference: job._id, type: 'ESCROW', status: 'COMPLETED' }, session),
    aggregateTotal({ jobReference: job._id, type: 'PAYOUT', status: 'COMPLETED' }, session),
    aggregateTotal({ jobReference: job._id, type: 'REFUND', status: 'COMPLETED' }, session),
  ]);

  const agreedCents = toCents(application.agreedAmount || job.salary || 0);
  const paidCents = Math.min(agreedCents, Math.max(0, toCents(alreadyPaid)));
  const remainingAgreedCents = Math.max(0, agreedCents - paidCents);
  const jobAvailableCents = Math.max(0, toCents(escrowed) - toCents(jobPayouts) - toCents(jobRefunds));
  const heldForDisputeCents = Math.min(remainingAgreedCents, jobAvailableCents);
  const outstandingCents = Math.max(0, remainingAgreedCents - heldForDisputeCents);

  return {
    agreedAmount: fromCents(agreedCents),
    alreadyPaidAmount: fromCents(paidCents),
    remainingAgreedAmount: fromCents(remainingAgreedCents),
    fundsHeldAmount: fromCents(heldForDisputeCents),
    outstandingAmount: fromCents(outstandingCents),
    fundStatus: heldForDisputeCents === 0
      ? 'OUTSTANDING_PAYMENT'
      : outstandingCents > 0 ? 'PARTIALLY_HELD' : 'FUNDS_HELD',
  };
}
