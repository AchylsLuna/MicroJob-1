import mongoose from 'mongoose';
import { refundJobFunds } from '../services/jobFunds.js';
import { syncCapacity } from '../services/jobLifecycle.js';
import { queueNotification, deliverQueuedNotification } from '../services/notificationOutbox.js';
import { httpError, availableJobFilter } from '../lib/lifecyclePolicy.js';
import JobApplication from '../models/JobApplication.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import { createNotification } from '../lib/notificationService.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import { scoreJobForWorker } from '../lib/jobMatching.js';
import { getWorkerProfileRequirementError } from '../lib/profileCompleteness.js';
import { getReviewSummaries } from '../lib/reviewSummary.js';
import JobOffer from '../models/JobOffer.js';
import { encodePublicId, resolvePublicId } from '../lib/publicId.js';
import { serializePublicJob } from '../lib/jobDiscovery.js';
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
    job: obj.job?.title !== undefined ? serializePublicJob(obj.job) : encodePublicId(obj.job),
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
      select: 'title description company location jobType salary paymentMode workDates workStartTime workEndTime status deadline category skills requirements interviewRequired cancellationPending jobPoster positionsNeeded hiredCount createdAt',
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
  const userId = getUserId(req);
  if (!userId) return sendError(res, 401, 'Authentication required');
  const applicantProfile = await User.findById(userId).select('avatarUrl');
  const profileError = getWorkerProfileRequirementError(applicantProfile);
  if (profileError) return sendError(res, profileError.status, profileError.message, { code: profileError.code, missing: profileError.missing });
  const session = await mongoose.startSession(); let application;
  try {
    await session.withTransaction(async () => {
      const job = await Job.findOne({ _id: resolvePublicId(req.params.jobId), ...availableJobFilter() }).session(session);
      if (!job) throw httpError(409, 'This posting is no longer accepting applications.');
      if (String(job.jobPoster) === String(userId)) throw httpError(400, 'You cannot apply to your own job.');
      if (await JobApplication.exists({ job: job._id, applicant: userId }).session(session)) throw httpError(400, 'You have already applied for this posting.');
      [application] = await JobApplication.create([{ job: job._id, applicant: userId, resume: req.body?.resume || null, coverLetter: req.body?.coverLetter || null, status: 'Applied', timeline: [{ type: 'status_changed', status: 'Applied', actor: userId, note: 'Application submitted.', meta: { source: 'apply' } }] }], { session });
      if (!job.applicants.some((id) => String(id) === String(userId))) job.applicants.push(userId);
      job.fundsVersion = Number(job.fundsVersion || 0) + 1; await job.save({ session });
      await queueNotification(`application-received:${application._id}`, {
        userId: String(job.jobPoster),
        audience: 'employer',
        type: 'application',
        title: `New application for ${job.title}`,
        message: `A worker applied for your job posting "${job.title}". Review their application in Applications.`,
        entityType: 'application',
        entityId: String(application._id),
        actor: userId,
        metadata: { jobId: String(job._id), jobTitle: job.title },
      }, session);
    });
    await deliverQueuedNotification(`application-received:${application._id}`);
    return sendSuccess(res, 201, 'Application submitted successfully', serializeApplication(application), { application: serializeApplication(application) });
  } catch (error) { return sendError(res, error.code === 11000 ? 409 : error.status || 500, error.status ? error.message : 'Unable to submit this application.'); }
  finally { await session.endSession(); }
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
      const latestOffer = latestOfferByApplication.get(String(application._id));
      return {
        ...value,
        offer: latestOffer ? {
          id: String(latestOffer._id),
          amount: Number(latestOffer.amount || 0),
          status: latestOffer.status,
          createdAt: latestOffer.createdAt,
          acceptedAt: latestOffer.acceptedAt,
          expiresAt: latestOffer.expiresAt,
        } : null,
      };
    }));
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
  const session = await mongoose.startSession(); let application;
  try {
    await session.withTransaction(async () => {
      const userId = getUserId(req);
      application = await JobApplication.findOne({ _id: req.params.applicationId, applicant: userId }).session(session);
      if (!application) throw httpError(404, 'Application not found.');
      if (['Hired', 'Accepted', 'Cancelled', 'Position filled', 'Rejected', 'Withdrawn', 'Offer Sent'].includes(application.status)) throw httpError(409, 'This application cannot be withdrawn; use assignment cancellation after hiring.');
      const job = await Job.findById(application.job).session(session);
      const offers = await JobOffer.find({ application: application._id, status: { $in: ['pending', 'accepted'] } }).session(session);
      for (const offer of offers) {
        await refundJobFunds({ job, amount: Number(offer.additionalEscrow || 0), reference: `offer-extra-refund:${offer._id}`, preferredWallet: 'EMPLOYER', actor: userId, session });
        offer.status = 'cancelled'; offer.cancellationReason = 'Application withdrawn by worker.'; offer.resolvedAt = new Date(); await offer.save({ session });
      }
      application.status = 'Withdrawn'; application.withdrawnAt = new Date(); application.employerHidden = true; application.employerHiddenAt = new Date();
      appendTimeline(application, { type: 'withdrawn', status: 'Withdrawn', actor: userId, note: 'Application withdrawn by worker.' }); await application.save({ session });
      // The application remains a durable historical record.
      job.applicants = job.applicants.filter((value) => String(value) !== String(userId));
      await syncCapacity(job, session);
      await queueNotification(`application-withdrawn:${application._id}:${application.withdrawnAt.getTime()}`, { userId: String(job.jobPoster), audience: 'employer', type: 'application', title: 'Application withdrawn', message: `A worker withdrew their application for ${job.title}.`, entityType: 'application', entityId: String(application._id) }, session);
    });
    return sendSuccess(res, 200, 'Application withdrawn successfully', serializeApplication(application), { application: serializeApplication(application) });
  } catch (error) { return sendError(res, error.status || 500, error.status ? error.message : 'Unable to withdraw application.'); }
  finally { await session.endSession(); }
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

    if (['Hired', 'Accepted', 'Cancelled', 'Position filled'].includes(previousStatus)) return sendError(res, 409, 'Use the cancellation workflow for hired or closed applications.');
    if (await JobOffer.exists({ application: application._id, status: { $in: ['pending', 'accepted'] } })) return sendError(res, 409, 'Cancel the formal offer with a reason before changing this application.');
    if (canonicalStatus === 'Offer Sent') return sendError(res, 409, 'Send a formal offer instead of changing this status.');

    application.status = canonicalStatus;
    application.applicantReadAt = null;
    appendTimeline(application, {
      type: 'status_changed',
      status: canonicalStatus,
      note: note ? String(note).trim() : `Application moved to ${getApplicationTimelineLabel(canonicalStatus)}.`,
      actor: getUserId(req),
      meta: { previousStatus },
    });
    const changed = await JobApplication.updateOne({ _id: application._id, status: previousStatus }, { $set: { status: canonicalStatus, applicantReadAt: null }, $push: { timeline: application.timeline.at(-1).toObject() } });
    if (!changed.modifiedCount) return sendError(res, 409, 'The application changed. Refresh before trying again.');
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
      const resolvedJobId = resolvePublicId(jobId);
      if (!resolvedJobId) return sendError(res, 400, 'A valid job id is required.');
      if (!jobIds.some((id) => String(id) === resolvedJobId)) {
        return sendError(res, 403, 'Not authorized to view applicants for this job.');
      }
      filter.job = resolvedJobId;
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
          expiresAt: latestOfferByApplication.get(String(application._id)).expiresAt,
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

export const restoreEmployerApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const result = await ensureEmployerAccess(applicationId, getUserId(req));
    if (result.error) return sendError(res, result.status, result.error);

    const application = result.application;
    application.employerHidden = false;
    application.employerHiddenAt = null;
    await application.save();

    return sendSuccess(res, 200, 'Application restored', serializeApplication(application), {
      application: serializeApplication(application),
    });
  } catch (error) {
    console.error('Restore employer application error:', error);
    return sendError(res, 500, 'Server error', { error: error.message });
  }
};

export const deleteEmployerApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const result = await ensureEmployerAccess(applicationId, getUserId(req));
    if (result.error) return sendError(res, result.status, result.error);

    const application = result.application;
    application.employerHidden = true;
    application.employerHiddenAt = new Date();
    await application.save();

    return sendSuccess(res, 200, 'Application archived; history preserved', { applicationId }, { applicationId });
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
    const priorStatus = application.status;
    const priorUpdatedAt = application.updatedAt;
    if (['Hired', 'Accepted', 'Cancelled', 'Position filled', 'Rejected', 'Withdrawn', 'Offer Sent'].includes(application.status)) return sendError(res, 409, 'This application is no longer in the interview stage.');
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
    const changed = await JobApplication.updateOne({ _id: application._id, status: priorStatus, updatedAt: priorUpdatedAt }, {
      $set: { interviews: application.interviews.map((item) => item.toObject()), status: application.status, applicantReadAt: null },
      $push: { timeline: application.timeline[application.timeline.length - 1].toObject() },
    });
    if (!changed.modifiedCount) return sendError(res, 409, 'The application changed. Refresh before editing the interview.');

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
    const { scheduledAt, location, mode, notes, status } = req.body || {};

    const result = await ensureEmployerAccess(applicationId, getUserId(req));
    if (result.error) return sendError(res, result.status, result.error);
    const application = result.application;
    const priorStatus = application.status;
    const priorUpdatedAt = application.updatedAt;
    if (['Hired', 'Accepted', 'Cancelled', 'Position filled', 'Rejected', 'Withdrawn', 'Offer Sent'].includes(application.status)) return sendError(res, 409, 'This application is no longer in the interview stage.');

    const interview = application.interviews.id(interviewId);
    if (!interview) return sendError(res, 404, 'Interview not found');

    // Same reason as scheduleInterview above: this also reassigns
    // `status = 'Interview Scheduled'`, so on a Hired application it would
    // bypass the un-hire path and strand the escrow.
    if (application.status === 'Hired') {
      return sendError(res, 409, 'This worker is already hired. Release the hire first if you need to return them to interviewing.');
    }

    const previousScheduledAt = interview.scheduledAt;
    if (scheduledAt !== undefined) {
      const parsedDate = new Date(scheduledAt);
      if (Number.isNaN(parsedDate.getTime())) return sendError(res, 400, 'Invalid interview date.');
      interview.scheduledAt = parsedDate;
    }
    if (location !== undefined) interview.location = location ? String(location).trim() : null;
    if (mode !== undefined) interview.mode = mode ? String(mode).trim() : 'other';
    if (notes !== undefined) interview.notes = notes ? String(notes).trim() : null;
    if (status !== undefined) {
      if (!['scheduled', 'completed', 'cancelled'].includes(status)) return sendError(res, 400, 'Invalid interview outcome.');
      if (status === 'completed' && new Date(interview.scheduledAt).getTime() > Date.now()) return sendError(res, 409, 'A future interview cannot be completed.');
      interview.status = status; interview.completedAt = status === 'completed' ? new Date() : null;
    }
    interview.updatedAt = new Date();
    application.status = status === 'completed' ? 'Interviewed' : 'Interview Scheduled';
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
    const changed = await JobApplication.updateOne({ _id: application._id, status: priorStatus, updatedAt: priorUpdatedAt }, {
      $set: { interviews: application.interviews.map((item) => item.toObject()), status: application.status, applicantReadAt: null },
      $push: { timeline: application.timeline[application.timeline.length - 1].toObject() },
    });
    if (!changed.modifiedCount) return sendError(res, 409, 'The application changed. Refresh before editing the interview.');

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
