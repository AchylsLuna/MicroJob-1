import SavedJob from '../models/SavedJob.js';
import Job from '../models/Job.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import { encodePublicId, resolvePublicId } from '../lib/publicId.js';
import { serializePublicJob } from '../lib/jobDiscovery.js';

const getUserId = (req) => req.user?.id || req.user?.userId || null;
const serializeSavedJob = (record, viewerId) => ({
  _id: encodePublicId(record._id),
  job: serializePublicJob(record.job, { viewerId }),
  createdAt: record.createdAt,
  savedAt: record.createdAt,
});

export async function listSavedJobs(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return sendError(res, 401, 'Authentication required.');

    const records = await SavedJob.find({ user: userId })
      .populate({
        path: 'job',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'jobPoster', select: 'firstName lastName companyName avatarUrl' },
        ],
      })
      .sort({ createdAt: -1 });

    const jobs = records.filter((item) => item.job).map((item) => serializeSavedJob(item, userId));

    return sendSuccess(res, 200, 'Saved jobs retrieved.', jobs, { savedJobs: jobs });
  } catch (error) {
    console.error('List saved jobs error:', error);
    return sendError(res, 500, 'Failed to load saved jobs.');
  }
}

export async function saveJob(req, res) {
  try {
    const userId = getUserId(req);
    const jobId = resolvePublicId(req.body?.jobId);
    if (!userId) return sendError(res, 401, 'Authentication required.');
    if (!jobId) return sendError(res, 400, 'A valid jobId is required.');

    const job = await Job.findById(jobId);
    if (!job) return sendError(res, 404, 'Job not found.');

    const saved = await SavedJob.findOneAndUpdate(
      { user: userId, job: jobId },
      { $setOnInsert: { user: userId, job: jobId } },
      { returnDocument: 'after', upsert: true }
    ).populate({
      path: 'job',
      populate: [
        { path: 'category', select: 'name' },
        { path: 'jobPoster', select: 'firstName lastName companyName avatarUrl' },
      ],
    });

    const value = serializeSavedJob(saved, userId);
    return sendSuccess(res, 201, 'Job saved.', value, { savedJob: value });
  } catch (error) {
    if (error?.code === 11000) {
      return sendError(res, 409, 'Job is already saved.');
    }
    console.error('Save job error:', error);
    return sendError(res, 500, 'Failed to save job.');
  }
}

export async function removeSavedJob(req, res) {
  try {
    const userId = getUserId(req);
    const jobId = resolvePublicId(req.params.jobId);
    if (!userId) return sendError(res, 401, 'Authentication required.');
    if (!jobId) return sendError(res, 400, 'A valid jobId is required.');

    const result = await SavedJob.findOneAndDelete({ user: userId, job: jobId });
    if (!result) return sendError(res, 404, 'Saved job not found.');

    const publicJobId = encodePublicId(jobId);
    return sendSuccess(res, 200, 'Saved job removed.', { jobId: publicJobId }, { jobId: publicJobId });
  } catch (error) {
    console.error('Remove saved job error:', error);
    return sendError(res, 500, 'Failed to remove saved job.');
  }
}
