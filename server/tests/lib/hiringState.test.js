import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPLOYER_MUTABLE_STATUSES,
  canUnhireApplication,
  computeUnhireRefund,
  countCommittedPositions,
  isAtCapacity,
  isEmployerMutableStatus,
  isHiredStatus,
  isUnhireTransition,
  nextHiredCount,
  resolveJobAvailability,
} from '../../lib/hiringState.js';

test('employers cannot set Hired directly; hiring goes through the offer flow', () => {
  assert.equal(EMPLOYER_MUTABLE_STATUSES.includes('Hired'), false);
  assert.equal(isEmployerMutableStatus('Hired'), false);
  assert.equal(isEmployerMutableStatus('Accepted'), false);

  for (const status of ['Applied', 'Shortlisted', 'Interview Scheduled', 'Interviewed', 'Offer Sent', 'Rejected']) {
    assert.equal(isEmployerMutableStatus(status), true, `${status} should be settable`);
  }
});

test('isHiredStatus treats the legacy Accepted spelling as hired', () => {
  assert.equal(isHiredStatus('Hired'), true);
  assert.equal(isHiredStatus('Accepted'), true);
  assert.equal(isHiredStatus(' Hired '), true);
  assert.equal(isHiredStatus('Applied'), false);
  assert.equal(isHiredStatus(undefined), false);
});

test('committed positions include pending offer reservations', () => {
  assert.equal(countCommittedPositions({ hiredCount: 1, reservedOfferCount: 2 }), 3);
  assert.equal(countCommittedPositions({ hiredCount: 0, reservedOfferCount: 0 }), 0);
  // Missing/garbage counters must not poison the math.
  assert.equal(countCommittedPositions({}), 0);
  assert.equal(countCommittedPositions({ hiredCount: -5, reservedOfferCount: 'x' }), 0);
});

test('a job with all positions reserved by offers is at capacity', () => {
  // Regression: capacity previously ignored reservedOfferCount, so a job whose
  // only position was committed to a pending offer still looked Available.
  assert.equal(isAtCapacity({ hiredCount: 0, reservedOfferCount: 1, positionsNeeded: 1 }), true);
  assert.equal(isAtCapacity({ hiredCount: 1, reservedOfferCount: 0, positionsNeeded: 1 }), true);
  assert.equal(isAtCapacity({ hiredCount: 1, reservedOfferCount: 1, positionsNeeded: 3 }), false);
});

test('resolveJobAvailability closes a job once every position is committed', () => {
  assert.equal(
    resolveJobAvailability({ status: 'Available', hiredCount: 1, reservedOfferCount: 0, positionsNeeded: 1 }),
    'Closed',
  );
  assert.equal(
    resolveJobAvailability({ status: 'Available', hiredCount: 0, reservedOfferCount: 2, positionsNeeded: 2 }),
    'Closed',
  );
});

test('resolveJobAvailability reopens a capacity-closed job when a position frees up', () => {
  assert.equal(
    resolveJobAvailability({
      status: 'Closed',
      hiredCount: 0,
      reservedOfferCount: 0,
      positionsNeeded: 1,
      closedManually: false,
    }),
    'Available',
  );
});

test('resolveJobAvailability never reopens a job the employer closed by hand', () => {
  // Regression (Bug 2): rejecting any applicant on a manually closed job used to
  // flip it back to Available and start collecting applications again.
  assert.equal(
    resolveJobAvailability({
      status: 'Closed',
      hiredCount: 0,
      reservedOfferCount: 0,
      positionsNeeded: 5,
      closedManually: true,
    }),
    'Closed',
  );
});

test('resolveJobAvailability leaves terminal job states untouched', () => {
  for (const status of ['Completed', 'Cancelled', 'In Progress']) {
    assert.equal(
      resolveJobAvailability({ status, hiredCount: 0, reservedOfferCount: 0, positionsNeeded: 4 }),
      status,
      `${status} must not be auto-managed`,
    );
    // Even at capacity a terminal state must not be rewritten to Closed.
    assert.equal(
      resolveJobAvailability({ status, hiredCount: 4, reservedOfferCount: 0, positionsNeeded: 4 }),
      status,
    );
  }
});

test('nextHiredCount increments on hire and decrements on un-hire', () => {
  assert.equal(nextHiredCount({ previousStatus: 'Offer Sent', nextStatus: 'Hired', hiredCount: 0 }), 1);
  assert.equal(nextHiredCount({ previousStatus: 'Hired', nextStatus: 'Rejected', hiredCount: 2 }), 1);
  // Unrelated transitions leave the count alone.
  assert.equal(nextHiredCount({ previousStatus: 'Applied', nextStatus: 'Shortlisted', hiredCount: 3 }), 3);
  // Never below zero, even if the stored counter is already wrong.
  assert.equal(nextHiredCount({ previousStatus: 'Hired', nextStatus: 'Rejected', hiredCount: 0 }), 0);
});

test('nextHiredCount does not double count a legacy Accepted to Hired migration', () => {
  assert.equal(nextHiredCount({ previousStatus: 'Accepted', nextStatus: 'Hired', hiredCount: 1 }), 1);
});

test('isUnhireTransition detects only moves away from a hired state', () => {
  assert.equal(isUnhireTransition({ previousStatus: 'Hired', nextStatus: 'Rejected' }), true);
  assert.equal(isUnhireTransition({ previousStatus: 'Accepted', nextStatus: 'Applied' }), true);
  assert.equal(isUnhireTransition({ previousStatus: 'Hired', nextStatus: 'Accepted' }), false);
  assert.equal(isUnhireTransition({ previousStatus: 'Applied', nextStatus: 'Rejected' }), false);
});

test('un-hiring is allowed while escrow is still held', () => {
  assert.deepEqual(canUnhireApplication({ paymentStatus: 'Secured' }), { allowed: true, reason: null });
  assert.deepEqual(canUnhireApplication({ paymentStatus: 'Failed' }), { allowed: true, reason: null });
  // Default (no explicit status) behaves as Secured.
  assert.equal(canUnhireApplication({}).allowed, true);
});

test('un-hiring is refused once payment is in flight or already paid', () => {
  const paid = canUnhireApplication({ paymentStatus: 'Paid' });
  assert.equal(paid.allowed, false);
  assert.match(paid.reason, /already been paid/i);

  for (const status of ['Authorized', 'Processing']) {
    const result = canUnhireApplication({ paymentStatus: status });
    assert.equal(result.allowed, false, `${status} must block un-hire`);
    assert.match(result.reason, /resolve the payment/i);
  }
});

test('computeUnhireRefund returns the negotiated escrow above base salary', () => {
  // Regression (Bug 3): this amount was debited from the employer for this
  // specific worker and was previously stranded when the hire was undone.
  assert.equal(computeUnhireRefund({ additionalEscrow: 250 }), 250);
  assert.equal(computeUnhireRefund({ offerAmount: 1200, jobSalary: 1000 }), 200);
});

test('computeUnhireRefund returns zero when nothing extra was escrowed', () => {
  assert.equal(computeUnhireRefund({ offerAmount: 1000, jobSalary: 1000 }), 0);
  // A below-base agreed amount must never produce a negative refund.
  assert.equal(computeUnhireRefund({ offerAmount: 800, jobSalary: 1000 }), 0);
  assert.equal(computeUnhireRefund({}), 0);
  assert.equal(computeUnhireRefund({ additionalEscrow: 0, offerAmount: null, jobSalary: null }), 0);
});

test('computeUnhireRefund rounds to centavos', () => {
  assert.equal(computeUnhireRefund({ additionalEscrow: 10.129 }), 10.13);
});

test('computeUnhireRefund returns exactly what the offer flow debited', () => {
  // The refund must mirror the debit, so it deliberately reuses the same
  // expression JobOfferController uses to compute the extra escrow. Binary
  // floating point makes 1000.555 - 1000 land just under 0.555, so both sides
  // agree on 0.55; rounding "up" here would refund a centavo that was never
  // taken from the employer.
  const offerAmount = 1000.555;
  const jobSalary = 1000;
  const debitedByOfferFlow = Number((offerAmount - jobSalary).toFixed(2));

  assert.equal(computeUnhireRefund({ offerAmount, jobSalary }), debitedByOfferFlow);
  assert.equal(debitedByOfferFlow, 0.55);
});

test('computeUnhireRefund prefers the recorded escrow over recomputing from amounts', () => {
  // When the offer stored what it actually debited, trust it — that is the
  // authoritative figure even if salary has since been edited.
  assert.equal(
    computeUnhireRefund({ additionalEscrow: 200, offerAmount: 1200, jobSalary: 900 }),
    200,
  );
});
