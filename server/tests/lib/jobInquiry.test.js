import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildConversationKey,
  buildInquiryMessage,
  describeInquiryConversation,
  evaluateJobInquiry,
  getEmployerDisplayName,
  isJobConversationParticipant,
  normalizeOptionalJobId,
  parseConversationKey,
  resolveJobEmployerId,
  toIdString,
} from '../../lib/jobInquiry.js';

const EMPLOYER_ID = '64b7f9c2e1a4d5f6a7b8c9d0';
const WORKER_ID = '64b7f9c2e1a4d5f6a7b8c9d1';
const JOB_ID = '64b7f9c2e1a4d5f6a7b8c9d2';

test('toIdString unwraps populated refs, raw ids, and rejects empties', () => {
  assert.equal(toIdString(EMPLOYER_ID), EMPLOYER_ID);
  assert.equal(toIdString({ _id: EMPLOYER_ID }), EMPLOYER_ID);
  assert.equal(toIdString({ id: EMPLOYER_ID }), EMPLOYER_ID);
  assert.equal(toIdString({ userId: EMPLOYER_ID }), EMPLOYER_ID);
  assert.equal(toIdString(null), '');
  assert.equal(toIdString({}), '');
});

test('normalizeOptionalJobId treats client placeholders as a general thread', () => {
  assert.equal(normalizeOptionalJobId(JOB_ID), JOB_ID);
  assert.equal(normalizeOptionalJobId('null'), null);
  assert.equal(normalizeOptionalJobId('undefined'), null);
  assert.equal(normalizeOptionalJobId('general'), null);
  assert.equal(normalizeOptionalJobId(''), null);
});

test('conversation keys round-trip and keep job threads separate from general', () => {
  assert.equal(buildConversationKey(EMPLOYER_ID, JOB_ID), `${EMPLOYER_ID}::${JOB_ID}`);
  assert.equal(buildConversationKey(EMPLOYER_ID, null), `${EMPLOYER_ID}::general`);
  assert.notEqual(buildConversationKey(EMPLOYER_ID, JOB_ID), buildConversationKey(EMPLOYER_ID, null));
  assert.deepEqual(parseConversationKey(`${EMPLOYER_ID}::${JOB_ID}`), {
    otherUserId: EMPLOYER_ID,
    jobId: JOB_ID,
  });
  assert.deepEqual(parseConversationKey(`${EMPLOYER_ID}::general`), {
    otherUserId: EMPLOYER_ID,
    jobId: null,
  });
});

test('resolveJobEmployerId reads populated, raw, and legacy poster fields', () => {
  assert.equal(resolveJobEmployerId({ jobPoster: { _id: EMPLOYER_ID } }), EMPLOYER_ID);
  assert.equal(resolveJobEmployerId({ jobPoster: EMPLOYER_ID }), EMPLOYER_ID);
  assert.equal(resolveJobEmployerId({ postedBy: EMPLOYER_ID }), EMPLOYER_ID);
  assert.equal(resolveJobEmployerId({ employerId: EMPLOYER_ID }), EMPLOYER_ID);
  assert.equal(resolveJobEmployerId({ title: 'Orphan job' }), '');
  assert.equal(resolveJobEmployerId(null), '');
});

test('getEmployerDisplayName prefers company then full name', () => {
  assert.equal(getEmployerDisplayName({ companyName: 'Acme Corp', firstName: 'Ann' }), 'Acme Corp');
  assert.equal(getEmployerDisplayName({ firstName: 'Ann', lastName: 'Cruz' }), 'Ann Cruz');
  assert.equal(getEmployerDisplayName({}), 'Employer');
  assert.equal(getEmployerDisplayName(null), 'Employer');
});

test('evaluateJobInquiry resolves the employer from the job post', () => {
  const result = evaluateJobInquiry({
    job: { _id: JOB_ID, title: 'Deliver parcels', jobPoster: { _id: EMPLOYER_ID, companyName: 'Acme Corp' } },
    workerId: WORKER_ID,
  });

  assert.equal(result.error, null);
  assert.equal(result.employerId, EMPLOYER_ID);
  assert.equal(result.employerName, 'Acme Corp');
  assert.equal(result.jobId, JOB_ID);
  assert.equal(result.jobTitle, 'Deliver parcels');
});

test('evaluateJobInquiry rejects missing auth, missing job, orphan job, and self-inquiry', () => {
  assert.equal(evaluateJobInquiry({ job: { _id: JOB_ID }, workerId: '' }).error.status, 401);
  assert.equal(evaluateJobInquiry({ job: null, workerId: WORKER_ID }).error.status, 404);
  assert.equal(evaluateJobInquiry({ job: { _id: JOB_ID }, workerId: WORKER_ID }).error.status, 409);
  assert.equal(
    evaluateJobInquiry({ job: { _id: JOB_ID, jobPoster: 'not-an-object-id' }, workerId: WORKER_ID }).error.status,
    409,
  );
  assert.equal(
    evaluateJobInquiry({ job: { _id: JOB_ID, jobPoster: EMPLOYER_ID }, workerId: EMPLOYER_ID }).error.status,
    400,
  );
});

test('isJobConversationParticipant requires the job employer on one side', () => {
  const job = { _id: JOB_ID, jobPoster: EMPLOYER_ID };
  assert.equal(isJobConversationParticipant({ job, senderId: WORKER_ID, receiverId: EMPLOYER_ID }), true);
  assert.equal(isJobConversationParticipant({ job, senderId: EMPLOYER_ID, receiverId: WORKER_ID }), true);
  // Prevents attaching a job to an unrelated thread such as Admin/Support.
  assert.equal(
    isJobConversationParticipant({ job, senderId: WORKER_ID, receiverId: '64b7f9c2e1a4d5f6a7b8c9d9' }),
    false,
  );
  assert.equal(isJobConversationParticipant({ job: { _id: JOB_ID }, senderId: WORKER_ID, receiverId: EMPLOYER_ID }), false);
});

test('describeInquiryConversation returns the job-scoped thread descriptor', () => {
  assert.deepEqual(
    describeInquiryConversation({
      employerId: EMPLOYER_ID,
      employerName: 'Acme Corp',
      jobId: JOB_ID,
      jobTitle: 'Deliver parcels',
    }),
    {
      conversationId: `${EMPLOYER_ID}::${JOB_ID}`,
      otherUserId: EMPLOYER_ID,
      otherUserName: 'Acme Corp',
      jobId: JOB_ID,
      jobTitle: 'Deliver parcels',
    },
  );
});

test('buildInquiryMessage mentions the job title and greets the employer', () => {
  assert.equal(
    buildInquiryMessage({ jobTitle: 'Deliver parcels', employerName: 'Acme Corp' }),
    'Hi Acme Corp, I\'m interested in your job post "Deliver parcels". Could you share more details?',
  );
  assert.equal(
    buildInquiryMessage({ jobTitle: 'Deliver parcels' }),
    'Hello, I\'m interested in your job post "Deliver parcels". Could you share more details?',
  );
  assert.equal(
    buildInquiryMessage({}),
    "Hello, I'm interested in your job post. Could you share more details?",
  );
});
