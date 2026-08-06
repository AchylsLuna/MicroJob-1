import SavedJob from '../models/SavedJob.js';
import Job from '../models/Job.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';

const getUserId = (req) => req.user?.id || req.user?.userId || null;

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

    const jobs = records.filter((item) => item.job).map((item) => ({
      ...item.toObject(),
      savedAt: item.createdAt,
    }));

    return sendSuccess(res, 200, 'Saved jobs retrieved.', jobs, { savedJobs: jobs });
  } catch (error) {
    console.error('List saved jobs error:', error);
    return sendError(res, 500, 'Failed to load saved jobs.');
  }
}

export async function saveJob(req, res) {
  try {
    const userId = getUserId(req);
    const { jobId } = req.body || {};
    if (!userId) return sendError(res, 401, 'Authentication required.');
    if (!jobId) return sendError(res, 400, 'jobId is required.');

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

    return sendSuccess(res, 201, 'Job saved.', saved, { savedJob: saved });
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
    const { jobId } = req.params;
    if (!userId) return sendError(res, 401, 'Authentication required.');
    if (!jobId) return sendError(res, 400, 'jobId is required.');

    const result = await SavedJob.findOneAndDelete({ user: userId, job: jobId });
    if (!result) return sendError(res, 404, 'Saved job not found.');

    return sendSuccess(res, 200, 'Saved job removed.', { jobId }, { jobId });
  } catch (error) {
    console.error('Remove saved job error:', error);
    return sendError(res, 500, 'Failed to remove saved job.');
  }
}
