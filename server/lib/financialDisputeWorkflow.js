// Public case states summarize the existing investigation/Finance workflow.
// Payment states and Finance approval gates remain independent.
export const CASE_STATES = ['open', 'under_review', 'awaiting_evidence', 'escalated', 'resolved', 'closed'];
export const CASE_LABELS = { open: 'Open', under_review: 'Under Review', awaiting_evidence: 'Awaiting Evidence', escalated: 'Escalated', resolved: 'Resolved', closed: 'Closed' };

export function financialDisputeCaseState(doc) {
  if (doc.closedAt || doc.status === 'rejected') return 'closed';
  if (doc.active === false || (doc.status === 'resolved' && doc.investigationStatus !== 'UNDER_APPEAL')) return 'resolved';
  if (doc.escalatedAt || doc.investigationStatus === 'ESCALATED') return 'escalated';
  if (String(doc.investigationStatus).startsWith('AWAITING_')) return 'awaiting_evidence';
  if (doc.investigationStatus === 'OPEN' || (!doc.investigationStatus && doc.status === 'open')) return 'open';
  return 'under_review';
}
