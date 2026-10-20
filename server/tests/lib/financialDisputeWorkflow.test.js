import test from 'node:test';
import assert from 'node:assert/strict';
import { CASE_STATES, financialDisputeCaseState } from '../../lib/financialDisputeWorkflow.js';
import { requireEvidenceOpportunity } from '../../services/financialDisputeSettlement.js';

test('the six public case states preserve investigation, escalation, finality and appeals', () => {
  const cases = [
    [{ active: true, status: 'open', investigationStatus: 'OPEN' }, 'open'],
    [{ active: true, status: 'investigating', investigationStatus: 'PENDING_FINANCE_APPROVAL' }, 'under_review'],
    [{ active: true, investigationStatus: 'AWAITING_EMPLOYER_EVIDENCE' }, 'awaiting_evidence'],
    [{ active: true, investigationStatus: 'PENDING_FINANCE_APPROVAL', escalatedAt: new Date() }, 'escalated'],
    [{ active: false, status: 'resolved', escalatedAt: new Date() }, 'resolved'],
    [{ active: false, status: 'resolved', closedAt: new Date() }, 'closed'],
    [{ active: true, status: 'resolved', investigationStatus: 'UNDER_APPEAL' }, 'under_review'],
    [{ active: false, status: 'rejected' }, 'closed'],
    [{ active: true, status: 'open', investigationStatus: 'EVIDENCE_UNDER_REVIEW' }, 'under_review'],
  ];
  for (const [doc, state] of cases) assert.equal(financialDisputeCaseState(doc), state);
  assert.deepEqual([...new Set(cases.map(([, state]) => state))], CASE_STATES);
});

test('an appeal gives both participants a fresh evidence opportunity', () => {
  const appeal = new Date();
  const dispute = { worker: 'worker', employer: 'employer', appealSubmittedAt: appeal, evidenceDueAt: new Date(Date.now() + 86400000), evidence: [
    { uploadedBy: 'worker', uploadedAt: new Date(appeal.getTime() - 1000) },
    { uploadedBy: 'employer', uploadedAt: new Date(appeal.getTime() - 1000) },
  ] };
  assert.throws(() => requireEvidenceOpportunity(dispute), (error) => error.status === 409);
  dispute.evidence.push({ uploadedBy: 'worker', uploadedAt: appeal, noEvidence: true }, { uploadedBy: 'employer', uploadedAt: appeal, statement: 'Appeal response' });
  assert.doesNotThrow(() => requireEvidenceOpportunity(dispute));
});
