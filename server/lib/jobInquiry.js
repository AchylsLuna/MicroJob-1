import { isValidObjectId } from './messageSecurity.js';

export const GENERAL_CONVERSATION_SEGMENT = 'general';
export const CONVERSATION_KEY_SEPARATOR = '::';

/**
 * Normalizes any populated/unpopulated reference into a plain id string.
 */
export function toIdString(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    const candidate = value._id ?? value.id ?? value.userId ?? null;
    if (candidate) return String(candidate).trim();
    return '';
  }
  return String(value).trim();
}

/**
 * Treats the string placeholders sent by clients as "no job".
 */
export function normalizeOptionalJobId(jobId) {
  const value = toIdString(jobId);
  if (!value || value === 'null' || value === 'undefined' || value === GENERAL_CONVERSATION_SEGMENT) {
    return null;
  }
  return value;
}

/**
 * Conversation keys are `<otherUserId>::<jobId|general>` so a worker can hold one
 * thread per job with the same employer, and a separate general/support thread.
 */
export function buildConversationKey(otherUserId, jobId) {
  const otherId = toIdString(otherUserId);
  const normalizedJobId = normalizeOptionalJobId(jobId);
  return `${otherId}${CONVERSATION_KEY_SEPARATOR}${normalizedJobId || GENERAL_CONVERSATION_SEGMENT}`;
}

export function parseConversationKey(conversationKey) {
  const [otherUserId = '', jobSegment = GENERAL_CONVERSATION_SEGMENT] = String(conversationKey || '')
    .split(CONVERSATION_KEY_SEPARATOR);
  return {
    otherUserId: otherUserId.trim(),
    jobId: normalizeOptionalJobId(jobSegment),
  };
}

/**
 * Resolves the employer (job poster) from a job document regardless of whether
 * `jobPoster` is populated, a raw ObjectId, or provided under a legacy alias.
 */
export function resolveJobEmployerId(job) {
  if (!job) return '';
  const candidates = [job.jobPoster, job.employer, job.postedBy, job.jobPosterId, job.employerId, job.postedById];
  for (const candidate of candidates) {
    const id = toIdString(candidate);
    if (id) return id;
  }
  return '';
}

export function getEmployerDisplayName(poster) {
  if (!poster || typeof poster !== 'object') return 'Employer';
  const companyName = typeof poster.companyName === 'string' ? poster.companyName.trim() : '';
  if (companyName) return companyName;
  const firstName = typeof poster.firstName === 'string' ? poster.firstName.trim() : '';
  const lastName = typeof poster.lastName === 'string' ? poster.lastName.trim() : '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || 'Employer';
}

export function buildInquiryMessage({ jobTitle, employerName } = {}) {
  const title = String(jobTitle || '').trim();
  const greetingName = String(employerName || '').trim();
  const greeting = greetingName && greetingName !== 'Employer' ? `Hi ${greetingName}` : 'Hello';
  return title
    ? `${greeting}, I'm interested in your job post "${title}". Could you share more details?`
    : `${greeting}, I'm interested in your job post. Could you share more details?`;
}

/**
 * Validates a worker -> employer job inquiry and resolves the employer target.
 * Returns `{ error }` with an HTTP status when the inquiry cannot be routed,
 * otherwise the resolved employer/job descriptors.
 */
export function evaluateJobInquiry({ job, workerId } = {}) {
  const requesterId = toIdString(workerId);
  if (!requesterId) {
    return { error: { status: 401, message: 'Authentication required.' } };
  }
  if (!job) {
    return { error: { status: 404, message: 'Job not found.' } };
  }

  const employerId = resolveJobEmployerId(job);
  if (!employerId || !isValidObjectId(employerId)) {
    return { error: { status: 409, message: 'This job post has no employer assigned yet.' } };
  }
  if (employerId === requesterId) {
    return { error: { status: 400, message: 'You cannot send an inquiry about your own job post.' } };
  }

  const jobId = toIdString(job._id ?? job.id);
  return {
    error: null,
    employerId,
    employerName: getEmployerDisplayName(job.jobPoster),
    jobId,
    jobTitle: typeof job.title === 'string' ? job.title : '',
  };
}

/**
 * A job-scoped conversation is only valid between the employer who posted the job
 * and another user. This keeps job inquiries away from the Admin/Support thread.
 */
export function isJobConversationParticipant({ job, senderId, receiverId } = {}) {
  const employerId = resolveJobEmployerId(job);
  if (!employerId) return false;
  return employerId === toIdString(senderId) || employerId === toIdString(receiverId);
}

/**
 * Shape returned to clients so they can open the exact worker <-> employer thread.
 */
export function describeInquiryConversation({ employerId, employerName, jobId, jobTitle } = {}) {
  const otherUserId = toIdString(employerId);
  const normalizedJobId = normalizeOptionalJobId(jobId);
  return {
    conversationId: buildConversationKey(otherUserId, normalizedJobId),
    otherUserId,
    otherUserName: employerName || 'Employer',
    jobId: normalizedJobId,
    jobTitle: jobTitle || null,
  };
}
