import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import User from '../../models/User.js';
import Job from '../../models/Job.js';
import JobApplication from '../../models/JobApplication.js';
import SupportTicket from '../../models/SupportTicket.js';
import { getSupportTicketById, replyToSupportTicket } from '../../controllers/SupportController.js';
import { scheduleInterview, updateInterview } from '../../controllers/JobApplicationController.js';

let mongoServer;

const createResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

const createUser = async (overrides) => {
  const user = new User({
    email: `${new mongoose.Types.ObjectId()}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    status: 'active',
    ...overrides,
  });
  await user.setPassword('Password123!');
  return user.save();
};

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'support-hire-guard-tests' });
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Job.deleteMany({}),
    JobApplication.deleteMany({}), SupportTicket.deleteMany({}),
  ]);
});

/**
 * `getSupportTicketById` and `replyToSupportTicket` are mounted twice: under
 * /api/admin/support/tickets/... behind
 * requirePermission('support.tickets.handle'), and under /api/support/tickets/...
 * behind `auth` only, because users need their own tickets there.
 *
 * Support scope used to be derived from the *role*, so any admin-shaped account
 * -- finance_team, analytics_team, moderator, none of which hold
 * support.tickets.handle -- got unscoped access plus internal notes and private
 * fields through the user-facing path, routing straight around the permission
 * matrix. Scope is now derived from the permission instead.
 */
const ticketFor = async (requester) => SupportTicket.create({
  requester: requester._id,
  subject: 'Payout did not arrive',
  category: 'payment',
  messages: [{ author: requester._id, actorRole: 'user', body: 'Where is my payout?' }],
  internalNotes: [{ author: requester._id, body: 'Escalated to finance.' }],
});

for (const staffRole of ['finance_team', 'analytics_team', 'moderator']) {
  test(`a ${staffRole} admin cannot read another user's ticket through the user-facing path`, async () => {
    const requester = await createUser({ role: 'work' });
    const staff = await createUser({ role: 'admin', staffRole });
    const ticket = await ticketFor(requester);

    const res = createResponse();
    await getSupportTicketById(
      { params: { ticketId: String(ticket._id) }, user: { id: staff._id.toString(), role: 'admin', staffRole } },
      res,
    );

    assert.equal(res.statusCode, 404, 'without support.tickets.handle the ticket must not resolve');
  });
}

test('a support_staff admin can still read any ticket, internal notes included', async () => {
  const requester = await createUser({ role: 'work' });
  const staff = await createUser({ role: 'admin', staffRole: 'support_staff' });
  const ticket = await ticketFor(requester);

  const res = createResponse();
  await getSupportTicketById(
    { params: { ticketId: String(ticket._id) }, user: { id: staff._id.toString(), role: 'admin', staffRole: 'support_staff' } },
    res,
  );

  assert.equal(res.statusCode, 200, 'the permission holder keeps full support scope');
  // sendSuccess drops an `extra` key whose value is identical to `data`
  // (`Object.is(value, data)` in lib/apiResponse.js), and the handler passes
  // the same object as both -- so the ticket arrives under `data`, not `ticket`.
  assert.ok(res.payload.data, 'the ticket is returned');
  assert.equal(String(res.payload.data.subject), 'Payout did not arrive');
  assert.ok(Array.isArray(res.payload.data.internalNotes), 'internal notes stay visible to the permission holder');
});

test('the ticket owner can still read their own ticket', async () => {
  const requester = await createUser({ role: 'work' });
  const ticket = await ticketFor(requester);

  const res = createResponse();
  await getSupportTicketById(
    { params: { ticketId: String(ticket._id) }, user: { id: requester._id.toString(), role: 'work' } },
    res,
  );

  assert.equal(res.statusCode, 200);
});

test("a finance_team admin cannot reply to another user's ticket through the user-facing path", async () => {
  const requester = await createUser({ role: 'work' });
  const staff = await createUser({ role: 'admin', staffRole: 'finance_team' });
  const ticket = await ticketFor(requester);

  const res = createResponse();
  await replyToSupportTicket(
    {
      params: { ticketId: String(ticket._id) },
      body: { message: 'Posting as support.' },
      user: { id: staff._id.toString(), role: 'admin', staffRole: 'finance_team' },
    },
    res,
  );

  assert.equal(res.statusCode, 404);
  const after = await SupportTicket.findById(ticket._id);
  assert.equal(after.messages.length, 1, 'no reply may be appended');
});

/**
 * `scheduleInterview` and `updateInterview` both reassigned
 * `status = 'Interview Scheduled'` after only ensureEmployerAccess, which on a
 * Hired application skipped the un-hire path
 * (isUnhireTransition -> revertHire -> canUnhireApplication -> refundUnhireEscrow)
 * and never called syncJobHiringState. hiredCount kept counting the hire, the
 * escrow stayed debited, and settleApplicationPayment -- which requires status
 * 'Hired' -- could no longer pay the worker.
 */
const hiredApplication = async () => {
  const employer = await createUser({ role: 'hire' });
  const worker = await createUser({ role: 'work' });
  const job = await Job.create({
    title: 'Community cleanup',
    description: 'Cleanup',
    location: 'Pasig',
    salary: 500,
    jobType: 'Short-term',
    deadline: new Date('2027-01-01'),
    positionsNeeded: 1,
    hiredCount: 1,
    status: 'Closed',
    jobPoster: employer._id,
  });
  const application = await JobApplication.create({
    job: job._id,
    applicant: worker._id,
    status: 'Hired',
    agreedAmount: 500,
    paymentStatus: 'Authorized',
    interviews: [{ scheduledAt: new Date('2026-12-01'), mode: 'other', createdBy: employer._id }],
  });
  return { employer, job, application };
};

test('scheduling an interview cannot silently un-hire a worker', async () => {
  const { employer, job, application } = await hiredApplication();

  const res = createResponse();
  await scheduleInterview(
    {
      params: { applicationId: String(application._id) },
      body: { scheduledAt: new Date('2027-02-01').toISOString() },
      user: { id: employer._id.toString(), role: 'hire' },
    },
    res,
  );

  assert.equal(res.statusCode, 409);
  const after = await JobApplication.findById(application._id);
  assert.equal(after.status, 'Hired', 'the hire must survive');
  assert.equal(after.paymentStatus, 'Authorized', 'the payment lifecycle must not be orphaned');
  assert.equal((await Job.findById(job._id)).hiredCount, 1, 'hiredCount stays consistent with the hire');
});

test('updating an interview cannot silently un-hire a worker', async () => {
  const { employer, application } = await hiredApplication();
  const interviewId = String(application.interviews[0]._id);

  const res = createResponse();
  await updateInterview(
    {
      params: { applicationId: String(application._id), interviewId },
      body: { notes: 'Moved to a call' },
      user: { id: employer._id.toString(), role: 'hire' },
    },
    res,
  );

  assert.equal(res.statusCode, 409);
  assert.equal((await JobApplication.findById(application._id)).status, 'Hired');
});
