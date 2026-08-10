import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import User from '../models/User.js';
import { addCityFilter, serializePublicJob } from '../lib/jobDiscovery.js';
import { scoreJobForWorker } from '../lib/jobMatching.js';

const getUserId = (req) => req.user?.id || req.user?.userId || null;

export async function getRecommendedJobs(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Authentication required.' });

    const worker = await User.findById(userId)
      .select('skills workExperience jobPreferences preferredCategories jobPosition about totalExperience city province')
      .populate('preferredCategories', 'name');
    if (!worker) return res.status(404).json({ message: 'Worker profile not found.' });

    const applied = await JobApplication.find({ applicant: userId }).select('job').lean();
    const excludedJobIds = applied.map((item) => item.job).filter(Boolean);
    const limit = Math.max(1, Math.min(50, Number(req.query?.limit) || 12));
    const filter = addCityFilter(
      {
        status: 'Available',
        deadline: { $gte: new Date() },
        jobPoster: { $ne: userId },
        ...(excludedJobIds.length ? { _id: { $nin: excludedJobIds } } : {}),
      },
      String(worker.city || '').trim()
    );

    const jobs = await Job.find(filter)
      .populate('category', 'name')
      .populate('jobPoster', 'firstName lastName companyName avatarUrl')
      .sort({ urgent: -1, createdAt: -1 })
      .limit(100);

    const recommendations = jobs
      .map((job) => ({
        ...serializePublicJob(job),
        match: scoreJobForWorker(job, worker),
      }))
      .sort((left, right) =>
        right.match.percentage - left.match.percentage ||
        Number(Boolean(right.urgent)) - Number(Boolean(left.urgent)) ||
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      )
      .slice(0, limit);

    return res.status(200).json(recommendations);
  } catch (error) {
    console.error('Get recommended jobs error:', error);
    return res.status(500).json({ message: 'Failed to load recommended jobs.' });
  }
}

