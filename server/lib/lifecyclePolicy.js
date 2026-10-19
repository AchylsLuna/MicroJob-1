export const POLICY_VERSION = '2026-10-16';
export const HOUR = 60 * 60 * 1000;
export const CANCELLATION_RESPONSE_MS = 72 * HOUR;
export const EVIDENCE_WINDOW_MS = 7 * 24 * HOUR;
export const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export const httpError = (status, message) => Object.assign(new Error(message), { status, statusCode: status });
export function requireReason(value) {
  const reason = String(value || '').trim();
  if (!reason || reason.length > 2000) throw httpError(400, 'A reason between 1 and 2000 characters is required.');
  return reason;
}
export function canFileNonpayment(application, now = Date.now()) {
  if (application.dailyPayments?.length) {
    return !application.cancellationPending && !application.disputePending && application.status !== 'Cancelled'
      && !['Paid', 'Processing', 'Refunded', 'Disputed'].includes(application.paymentStatus)
      && application.dailyPayments.some((day) => day.submittedAt && !day.paidAt && now >= new Date(day.submittedAt).getTime() + 72 * HOUR);
  }
  return !['Paid', 'Processing', 'Refunded', 'Partially paid'].includes(application.paymentStatus)
    && application.status !== 'Cancelled'
    && Boolean(application.firstSubmittedAt || application.workSubmittedAt)
    && now >= new Date(application.firstSubmittedAt || application.workSubmittedAt).getTime() + 72 * HOUR;
}
export function availableJobFilter(now = new Date()) {
  return { status: { $in: ['Available', 'In Progress'] }, closedManually: { $ne: true }, cancellationPending: { $ne: true }, archivedAt: null, deadline: { $gt: now }, $expr: { $lt: [{ $add: [{ $ifNull: ['$hiredCount', 0] }, { $ifNull: ['$reservedOfferCount', 0] }] }, { $ifNull: ['$positionsNeeded', 1] }] } };
}

export function recruitmentState(job, now = new Date()) {
  const availablePositions = Math.max(0, Number(job.positionsNeeded || 1) - Number(job.hiredCount || 0) - Number(job.reservedOfferCount || 0));
  return { availablePositions, recruitmentOpen: ['Available', 'In Progress'].includes(job.status) && !job.closedManually && !job.cancellationPending && !job.archivedAt && new Date(job.deadline).getTime() > now.getTime() && availablePositions > 0 };
}
