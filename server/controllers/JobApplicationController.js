import JobApplication from '../models/JobApplication.js';
import Job from '../models/Job.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { createNotification } from '../lib/notificationService.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import { scoreJobForWorker } from '../lib/jobMatching.js';
import { getReviewSummaries } from '../lib/reviewSummary.js';
import JobOffer from '../models/JobOffer.js';
import {
  APPLICATION_STATUSES,
  getApplicationTimelineLabel,
  toCanonicalApplicationStatus,
} from '../lib/applicationStatus.js';

// Hiring is not a plain status edit: it reserves a position, pins an agreed
// amount, and secures escrow. That happens in the offer flow
// (JobOfferController.confirmOfferHire), so 'Hired' is intentionally absent
// from the statuses an employer may set directly here.
import {
  EMPLOYER_MUTABLE_STATUSES,
  canUnhireApplication,
  computeUnhireRefund,
  isUnhireTransition,
  nextHiredCount,
  resolveJobAvailability,
} from '../lib/hiringState.js';

const getUserId = (req) => req.user?.id || req.user?.userId || null;

const appendTimeline = (application, { type, status = null, note = null, actor = null, meta = {} }) => {
  if (!Array.isArray(application.timeline)) {
    application.timeline = [];
  }
  application.timeline.push({
    type,
    status,
    note,
    actor,
    meta,
    createdAt: new Date(),
  });
};

const getNextInterview = (application) => {
  const interviews = Array.isArray(application?.interviews) ? application.interviews : [];
  const now = Date.now();
  const upcoming = interviews
    .map((item) => ({ ...item.toObject?.() || item, scheduledAtMs: new Date(item.scheduledAt).getTime() }))
    .filter((item) => Number.isFinite(item.scheduledAtMs) && item.scheduledAtMs >= now)
    .sort((a, b) => a.scheduledAtMs - b.scheduledAtMs);
  if (!upcoming.length) return null;
  const next = upcoming[0];
  return {
    _id: next._id,
    scheduledAt: next.scheduledAt,
    location: next.location || null,
    mode: next.mode || 'other',
    notes: next.notes || null,
  };
};

const serializeApplication = (application) => {
  const obj = application?.toObject ? application.toObject() : application;
  if (!obj) return null;
  return {
    ...obj,
    nextInterview: getNextInterview(obj),
  };
};

const populateUserApplicationQuery = (query) =>
  query.populate({
    path: 'job',
    populate: [
      { path: 'category', select: 'name' },
      { path: 'jobPoster', select: 'firstName lastName email companyName avatarUrl role status' },
    ],
  });

const populateEmployerApplicationQuery = (query) =>
  query
    .populate({
      path: 'job',
      select: 'title description company location jobType salary status deadline category skills requirements jobPoster positionsNeeded hiredCount createdAt',
      populate: { path: 'category', select: 'name' },
    })
    .populate(
      'applicant',
      'firstName lastName email role phoneNumber jobsApplied projectsCompleted successRate city province about jobPosition totalExperience avatarUrl resumeUrl resumeFileName skills workExperience jobPreferences preferredCategories status'
    );

const ensureEmployerAccess = async (applicationId, requesterId) => {
  const application = await JobApplication.findById(applicationId).populate('job');
  if (!application) return { error: 'Application not found', status: 404 };
  if (String(application.job?.jobPoster) !== String(requesterId)) {
    return { error: 'Not authorized to update this application', status: 403 };
  }
  return { application };
};

async function syncJobHiringState(application, previousStatus, nextStatus) {
  const jobDoc = await Job.findById(application.job?._id || application.job);
  if (!jobDoc) return;

  jobDoc.hiredCount = nextHiredCount({
    previousStatus,
    nextStatus,
    hiredCount: jobDoc.hiredCount,
  });

  // Availability follows committed positions (hires + pending offer holds) and
  // never reopens a post the employer closed by hand.
  jobDoc.status = resolveJobAvailability({
    status: jobDoc.status,
    hiredCount: jobDoc.hiredCount,
    reservedOfferCount: jobDoc.reservedOfferCount,
    positionsNeeded: jobDoc.positionsNeeded,
    closedManually: jobDoc.closedManually,
  });

  await jobDoc.save();
}

/**
 * Undo a hire: free the position and return the negotiated escrow that was
 * debited for this specific worker.
 *
 * The base salary escrow stays held for the now-vacant position and is settled
 * when the job completes; only the above-base amount is refunded here, mirroring
 * the refund path for a rejected/cancelled offer. Idempotent via the reference
 * key, so a retried un-hire cannot double-refund.
 */
async function refundUnhireEscrow(application, actorId) {
  const jobId = application.job?._id || application.job;
  const [jobDoc, offer] = await Promise.all([
    Job.findById(jobId).select('salary jobPoster'),
    JobOffer.findOne({
      application: application._id,
      status: { $in: ['accepted', 'hired'] },
    }).sort({ createdAt: -1 }),
  ]);

  const refund = computeUnhireRefund({
    offerAmount: offer?.amount ?? application.agreedAmount,
    additionalEscrow: offer?.additionalEscrow,
    jobSalary: jobDoc?.salary,
  });
  if (refund <= 0) return;

  const employerId = application.job?.jobPoster || jobDoc?.jobPoster || actorId;
  const reference = `unhire-refund:${application._id}`;
  if (await Transaction.exists({ reference })) return;

  await User.updateOne({ _id: employerId }, { $inc: { employerBalance: refund } });
  await Transaction.create({
    sender: null,
    receiver: employerId,
    amount: refund,
    type: 'REFUND',
    status: 'COMPLETED',
    balanceTarget: 'EMPLOYER',
    jobReference: jobId,
    reference,
    label: 'Hire reverted escrow refund',
    relatedEntityType: 'application',
    relatedEntityId: String(application._id),
    actor: actorId || employerId,
  });
}

/**
 * Release a hired application back into the pipeline: validate that the payment
 * state still allows it, refund negotiated escrow, and clear the hire lifecycle
 * fields so a stale 'Secured' payment cannot strand the money.
 *
 * Returns an error object when the un-hire must be refused.
 */
async function revertHire(application, nextStatus, actorId) {
  const permission = canUnhireApplication({ paymentStatus: application.paymentStatus });
  if (!permission.allowed) {
    return { error: permission.reason, status: 409 };
  }

  await refundUnhireEscrow(application, actorId);

  application.agreedAmount = null;
  application.workStatus = 'In Progress';
  application.paymentStatus = 'Secured';
  application.paymentAuthorizedAt = null;
  application.workSubmittedAt = null;
  application.changesRequestedAt = null;
  application.completedAt = null;

  await JobOffer.updateMany(
    { application: application._id, status: { $in: ['pending', 'accepted', 'hired'] } },
    { $set: { status: 'cancelled', resolvedAt: new Date() } }
  );

  appendTimeline(application, {
    type: 'hire_reverted',
    status: nextStatus,
    note: 'Hire reverted; reserved escrow returned to the employer.',
    actor: actorId,
    meta: { previousStatus: 'Hired' },
  });

  return { error: null };
}

async function notifyEmployerOfNewApplication({ application, job, userId }) {
  const jobPosterId = job.jobPoster?.toString();
  if (!jobPosterId) return;

  let applicantName = 'Applicant';
  try {
    const applicant = await User.findById(userId).select('firstName lastName');
    if (applicant) applicantName = [applicant.firstName, applicant.lastName].filter(Boolean).join(' ');
  } catch {
    // ignore name enrichment failures
  }

  await createNotification({
    userId: jobPosterId,
    audience: 'employer',
    type: 'application',
    title: 'New application',
    message: `${applicantName} applied for ${job.title}.`,
    entityType: 'application',
    entityId: application._id,
    actor: userId,
    link: '',
    socketEvent: 'new_application',
    socketPayload: {
      id: application._id,
      applicantId: userId,
      applicantName,
      jobId: job._id,
      jobTitle: job.title,
      createdAt: application.createdAt,
    },
    push: false,
  });
}

async function notifyApplicantStatusChange(application, actorId, title, message) {
  const applicant = application.applicant;
  // applicant may be a populated Document (has ._id) or a raw ObjectId — handle both
  const applicantId = applicant?._id ? String(applicant._id) : (applicant ? String(applicant) : null);
  if (!applicantId) return;

  await createNotification({
    userId: applicantId,
    audience: 'worker',
    type: 'application',
    title,
    message,
    entityType: 'application',
    entityId: application._id,
    actor: actorId,
    link: '',
    socketEvent: 'application_status_updated',
    socketPayload: {
      id: application._id,
      applicationId: application._id,
      jobId: application.job?._id || application.job,
      jobTitle: application.job?.title,
      status: application.status,
      updatedAt: application.updatedAt,
    },
    push: true,
  });
}

export const applyForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { resume, coverLetter } = req.body || {};
    const userId = getUserId(req);
    if (!userId) return sendError(res, 401, 'Authentication required');

    const job = await Job.findById(jobId);
    if (!job) {
      return sendError(res, 404, 'Job not found');
    }
    if (String(job.jobPoster) === String(userId)) {
      return sendError(res, 400, 'You cannot apply to your own job');
    }

    const existingApplication = await JobApplication.findOne({ job: jobId, applicant: userId });
    if (existingApplication) {
      return sendError(res, 400, 'You have already applied for this job');
    }

    const application = new JobApplication({
      job: jobId,
      applicant: userId,
      resume: resume || null,
      coverLetter: coverLetter || null,
      status: 'Applied',
    });
    appendTimeline(application, {
      type: 'status_changed',
      status: 'Applied',
      note: 'Application submitted.',
      actor: userId,
      meta: { source: 'apply' },
    });
    await application.save();

    if (!job.applicants.map((id) => String(id)).includes(String(userId))) {
      job.applicants.push(userId);
      await job.save();
    }

    await notifyEmployerOfNewApplication({ application, job, userId });

    return sendSuccess(res, 201, 'Application submitted successfully', serializeApplication(application), {
      application: serializeApplication(application),
    });
  } catch (error) {
    console.error('Apply for job error:', error);
    return sendError(res, 500, 'Server error', { error: error.message });
  }
};

export const getUserApplications = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { status } = req.query || {};

    const filter = { applicant: userId };
    if (status && status !== 'All') {
      const canonicalStatus = toCanonicalApplicationStatus(status);
      if (!canonicalStatus) {
        return sendError(res, 400, 'Invalid status');
      }
      filter.status = canonicalStatus;
    }

    const applications = await populateUserApplicationQuery(
      JobApplication.find(filter).sort({ updatedAt: -1 })
    );

    return res.status(200).json(applications.map(serializeApplication));
  } catch (error) {
    console.error('Get user applications error:', error);
    return sendError(res, 500, 'Server error', { error: error.message });
  }
};

export const getApplicationById = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const userId = getUserId(req);

    let application = await populateUserApplicationQuery(
      JobApplication.findOne({ _id: applicationId, applicant: userId })
    );

    if (!application) {
      const employerResult = await ensureEmployerAccess(applicationId, userId);
      if (employerResult.application) {
        application = await populateEmployerApplicationQuery(
          JobApplication.findById(applicationId)
        );
      }
    }

    if (!application) {
      return sendError(res, 404, 'Application not found');
    }

    return sendSuccess(res, 200, 'Application retrieved successfully', serializeApplication(application), {
      application: serializeApplication(application),
    });
  } catch (error) {
    console.error('Get application error:', error);
    return sendError(res, 500, 'Server error', { error: error.message });
  }
};

export const withdrawApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const userId = getUserId(req);

    const application = await JobApplication.findOne({ _id: applicationId, applicant: userId }).populate('job');
    if (!application) {
      return sendError(res, 404, 'Application not found');
    }
    if (application.status === 'Withdrawn') {
      return sendError(res, 400, 'Application is already withdrawn');
    }
    if (application.status === 'Hired') {
      return sendError(res, 400, 'Hired applications cannot be withdrawn');
    }

    const previousStatus = application.status;
    application.status = 'Withdrawn';
    application.withdrawnAt = new Date();
    application.applicantReadAt = new Date();
    application.employerReadAt = null;
    application.employerHidden = true;
    application.employerHiddenAt = new Date();
    appendTimeline(application, {
      type: 'status_changed',
      status: 'Withdrawn',
      note: 'Application withdrawn by applicant.',
      actor: userId,
      meta: { previousStatus },
    });
    await application.save();

    await Job.findByIdAndUpdate(application.job?._id || application.job, {
      $pull: { applicants: userId },
    });

    if (String(application.job?.jobPoster || '')) {
      await createNotification({
        userId: application.job.jobPoster,
        audience: 'employer',
        type: 'application',
        title: 'Application withdrawn',
        message: `An applicant withdrew from ${application.job?.title || 'your job'}.`,
        entityType: 'application',
        entityId: application._id,
        actor: userId,
        socketEvent: 'notification_created',
        socketPayload: {
          notification: {
            applicationId: application._id,
            status: application.status,
            jobId: application.job?._id,
            jobTitle: application.job?.title,
            updatedAt: application.updatedAt,
          },
        },
        push: false,
      });
    }

    return sendSuccess(res, 200, 'Application withdrawn successfully', serializeApplication(application), {
      application: serializeApplication(application),
    });
  } catch (error) {
    console.error('Withdraw application error:', error);
    return sendError(res, 500, 'Server error', { error: error.message });
  }
};

export const updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status, note } = req.body || {};
    const canonicalStatus = toCanonicalApplicationStatus(status);
    if (!canonicalStatus || !EMPLOYER_MUTABLE_STATUSES.includes(canonicalStatus)) {
      return sendError(
        res,
        400,
        `Invalid status. Expected one of ${EMPLOYER_MUTABLE_STATUSES.join(', ')}.`
      );
    }

    const result = await ensureEmployerAccess(applicationId, getUserId(req));
    if (result.error) {
      return sendError(res, result.status, result.error);
    }
    const application = result.application;

    const previousStatus = application.status;

    // Moving off a hired state frees the position and returns the escrow that
    // was reserved for this worker; refuse when payment is already in flight.
    if (isUnhireTransition({ previousStatus, nextStatus: canonicalStatus })) {
      const reverted = await revertHire(application, canonicalStatus, getUserId(req));
      if (reverted.error) {
        return sendError(res, reverted.status, reverted.error);
      }
    }

    application.status = canonicalStatus;
    application.applicantReadAt = null;
    appendTimeline(application, {
      type: 'status_changed',
      status: canonicalStatus,
      note: note ? String(note).trim() : `Application moved to ${getApplicationTimelineLabel(canonicalStatus)}.`,
      actor: getUserId(req),
      meta: { previousStatus },
    });
    await application.save();

    await syncJobHiringState(application, previousStatus, canonicalStatus);
    const populated = await populateEmployerApplicationQuery(JobApplication.findById(application._id));
    if (!populated) return sendError(res, 404, 'Application not found after save');

    await notifyApplicantStatusChange(
      populated,
      getUserId(req),
      'Application updated',
      `Your application for ${populated.job?.title || 'a job'} is now ${canonicalStatus.toLowerCase()}.`
    );

    return sendSuccess(res, 200, 'Application status updated successfully', serializeApplication(populated), {
      application: serializeApplication(populated),
    });
  } catch (error) {
    console.error('Update application status error:', error);
    return sendError(res, 500, 'Server error', { error: error.message });
  }
};

export const getEmployerApplications = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { status, jobId, search, includeHidden } = req.query || {};

    const postedJobs = await Job.find({ jobPoster: userId }).select('_id');
    const jobIds = postedJobs.map((job) => job._id);

    const filter = { job: { $in: jobIds } };
    if (includeHidden !== 'true') {
      filter.employerHidden = { $ne: true };
    }
    if (status && status !== 'All') {
      const canonicalStatus = toCanonicalApplicationStatus(status);
      if (!canonicalStatus) {
        return sendError(res, 400, 'Invalid status');
      }
      filter.status = canonicalStatus;
    }
    if (jobId && jobId !== 'All') {
      filter.job = jobId;
    }

    let applications = await populateEmployerApplicationQuery(
      JobApplication.find(filter).sort({ updatedAt: -1 })
    );
    applications = await JobApplication.populate(applications, {
      path: 'job.jobPoster',
      select: 'firstName lastName email companyName',
    });

    if (search) {
      const query = String(search).trim().toLowerCase();
      applications = applications.filter((app) => {
        const name = `${app.applicant?.firstName || ''} ${app.applicant?.lastName || ''}`.toLowerCase();
        const email = String(app.applicant?.email || '').toLowerCase();
        const title = String(app.job?.title || '').toLowerCase();
        return name.includes(query) || email.includes(query) || title.includes(query);
      });
    }

    const ratings = await getReviewSummaries(
      applications.map((application) => application.applicant?._id).filter(Boolean),
      'worker'
    );
    const offers = await JobOffer.find({ application: { $in: applications.map((application) => application._id) } })
      .sort({ createdAt: -1 })
      .lean();
    const latestOfferByApplication = new Map();
    for (const offer of offers) {
      const applicationId = String(offer.application);
      if (!latestOfferByApplication.has(applicationId)) latestOfferByApplication.set(applicationId, offer);
    }

    return res.status(200).json(applications.map((application) => {
      const value = serializeApplication(application);
      const applicantId = String(application.applicant?._id || '');
      return {
        ...value,
        match: scoreJobForWorker(application.job, application.applicant),
        offer: latestOfferByApplication.has(String(application._id)) ? {
          id: String(latestOfferByApplication.get(String(application._id))._id),
          amount: Number(latestOfferByApplication.get(String(application._id)).amount || 0),
          status: latestOfferByApplication.get(String(application._id)).status,
          createdAt: latestOfferByApplication.get(String(application._id)).createdAt,
          acceptedAt: latestOfferByApplication.get(String(application._id)).acceptedAt,
        } : null,
        applicant: value?.applicant ? {
          ...value.applicant,
          rating: ratings.get(applicantId) || { averageRating: 0, totalReviews: 0 },
        } : value?.applicant,
      };
    }));
  } catch (error) {
    console.error('Get employer applications error:', error);
    return sendError(res, 500, 'Server error', { error: error.message });
  }
};

export const markEmployerApplicationRead = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const result = await ensureEmployerAccess(applicationId, getUserId(req));
    if (result.error) return sendError(res, result.status, result.error);

    const application = result.application;
    application.employerReadAt = new Date();
    await application.save();

    return sendSuccess(res, 200, 'Notification marked as read', serializeApplication(application), {
      application: serializeApplication(application),
    });
  } catch (error) {
    console.error('Mark employer read error:', error);
    return sendError(res, 500, 'Server error', { error: error.message });
  }
};

export const hideEmployerApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const result = await ensureEmployerAccess(applicationId, getUserId(req));
    if (result.error) return sendError(res, result.status, result.error);

    const application = result.application;
    application.employerHidden = true;
    application.employerHiddenAt = new Date();
    await application.save();

    return sendSuccess(res, 200, 'Application removed', serializeApplication(application), {
      application: serializeApplication(application),
    });
  } catch (error) {
    console.error('Hide employer application error:', error);
    return sendError(res, 500, 'Server error', { error: error.message });
  }
};

export const deleteEmployerApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const result = await ensureEmployerAccess(applicationId, getUserId(req));
    if (result.error) return sendError(res, result.status, result.error);

    const application = result.application;
    // Deleting a hired application destroys the record, so the escrow reserved
    // for that worker has to be returned before it becomes unreachable.
    if (isUnhireTransition({ previousStatus: application.status, nextStatus: 'Rejected' })) {
      const reverted = await revertHire(application, 'Rejected', getUserId(req));
      if (reverted.error) {
        return sendError(res, reverted.status, reverted.error);
      }
      await syncJobHiringState(application, 'Hired', 'Rejected');
    }

    await Job.findByIdAndUpdate(application.job?._id || application.job, {
      $pull: { applicants: application.applicant },
    });

    await JobApplication.deleteOne({ _id: applicationId });

    return sendSuccess(res, 200, 'Application deleted', { applicationId }, { applicationId });
  } catch (error) {
    console.error('Delete employer application error:', error);
    return sendError(res, 500, 'Server error', { error: error.message });
  }
};

export const markApplicantApplicationRead = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const application = await JobApplication.findById(applicationId);
    if (!application) {
      return sendError(res, 404, 'Application not found');
    }
    if (String(application.applicant) !== String(getUserId(req))) {
      return sendError(res, 403, 'Not authorized to update this application');
    }

    application.applicantReadAt = new Date();
    await application.save();

    return sendSuccess(res, 200, 'Notification marked as read', serializeApplication(application), {
      application: serializeApplication(application),
    });
  } catch (error) {
    console.error('Mark applicant read error:', error);
    return sendError(res, 500, 'Server error', { error: error.message });
  }
};

export const scheduleInterview = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { scheduledAt, location = null, mode = 'other', notes = '' } = req.body || {};
    if (!scheduledAt) return sendError(res, 400, 'scheduledAt is required.');
    const parsedDate = new Date(scheduledAt);
    if (Number.isNaN(parsedDate.getTime())) return sendError(res, 400, 'Invalid interview date.');

    const result = await ensureEmployerAccess(applicationId, getUserId(req));
    if (result.error) return sendError(res, result.status, result.error);

    const application = result.application;
    application.interviews.push({
      scheduledAt: parsedDate,
      location: location ? String(location).trim() : null,
      mode: mode ? String(mode).trim() : 'other',
      notes: notes ? String(notes).trim() : null,
      createdBy: getUserId(req),
      updatedAt: new Date(),
    });
    application.status = 'Interview Scheduled';
    application.applicantReadAt = null;
    appendTimeline(application, {
      type: 'interview_scheduled',
      status: 'Interview Scheduled',
      note: `Interview scheduled for ${parsedDate.toISOString()}.`,
      actor: getUserId(req),
      meta: {
        scheduledAt: parsedDate,
        location: location ? String(location).trim() : null,
        mode: mode ? String(mode).trim() : 'other',
      },
    });
    await application.save();

    const populated = await populateEmployerApplicationQuery(JobApplication.findById(application._id));
    if (!populated) return sendError(res, 404, 'Application not found after save');
    await notifyApplicantStatusChange(
      populated,
      getUserId(req),
      'Interview scheduled',
      `An interview was scheduled for ${populated.job?.title || 'your application'}.`
    );

    return sendSuccess(res, 201, 'Interview scheduled successfully', serializeApplication(populated), {
      application: serializeApplication(populated),
    });
  } catch (error) {
    console.error('Schedule interview error:', error);
    return sendError(res, 500, 'Server error', { error: error.message });
  }
};

export const updateInterview = async (req, res) => {
  try {
    const { applicationId, interviewId } = req.params;
    const { scheduledAt, location, mode, notes } = req.body || {};

    const result = await ensureEmployerAccess(applicationId, getUserId(req));
    if (result.error) return sendError(res, result.status, result.error);
    const application = result.application;

    const interview = application.interviews.id(interviewId);
    if (!interview) return sendError(res, 404, 'Interview not found');

    const previousScheduledAt = interview.scheduledAt;
    if (scheduledAt !== undefined) {
      const parsedDate = new Date(scheduledAt);
      if (Number.isNaN(parsedDate.getTime())) return sendError(res, 400, 'Invalid interview date.');
      interview.scheduledAt = parsedDate;
    }
    if (location !== undefined) interview.location = location ? String(location).trim() : null;
    if (mode !== undefined) interview.mode = mode ? String(mode).trim() : 'other';
    if (notes !== undefined) interview.notes = notes ? String(notes).trim() : null;
    interview.updatedAt = new Date();
    application.status = 'Interview Scheduled';
    application.applicantReadAt = null;

    const timelineType = scheduledAt !== undefined ? 'interview_rescheduled' : 'interview_updated';
    appendTimeline(application, {
      type: timelineType,
      status: application.status,
      note: scheduledAt !== undefined
        ? `Interview rescheduled from ${new Date(previousScheduledAt).toISOString()} to ${new Date(interview.scheduledAt).toISOString()}.`
        : 'Interview notes updated.',
      actor: getUserId(req),
      meta: {
        interviewId: String(interview._id),
        scheduledAt: interview.scheduledAt,
        location: interview.location || null,
        mode: interview.mode || 'other',
      },
    });
    await application.save();

    const populated = await populateEmployerApplicationQuery(JobApplication.findById(application._id));
    await notifyApplicantStatusChange(
      populated,
      getUserId(req),
      scheduledAt !== undefined ? 'Interview updated' : 'Interview notes updated',
      `Your interview details for ${populated.job?.title || 'your application'} were updated.`
    );

    return sendSuccess(res, 200, 'Interview updated successfully', serializeApplication(populated), {
      application: serializeApplication(populated),
    });
  } catch (error) {
    console.error('Update interview error:', error);
    return sendError(res, 500, 'Server error', { error: error.message });
  }
};

export { APPLICATION_STATUSES };
