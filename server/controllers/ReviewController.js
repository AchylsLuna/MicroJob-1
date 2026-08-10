import mongoose from 'mongoose';
import Review from '../models/Review.js';
import JobApplication from '../models/JobApplication.js';
import { createNotification } from '../lib/notificationService.js';
import { getReviewSummary } from '../lib/reviewSummary.js';
import { serializeReview } from '../lib/reviewPresentation.js';

const getUserId = (req) => req.user?.id || req.user?.userId || null;
const HIRED_STATUSES = new Set(['Hired', 'Accepted']);
const ALLOWED_CRITERIA = new Set([
  'workQuality', 'reliability', 'professionalism', 'communication', 'overallPerformance',
  'paymentExperience', 'jobDescriptionAccuracy', 'overallExperience',
]);

const sanitizeCriteria = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const criteria = {};
  for (const [key, rawValue] of Object.entries(input)) {
    if (!ALLOWED_CRITERIA.has(key)) continue;
    const value = Number(rawValue);
    if (Number.isInteger(value) && value >= 1 && value <= 5) criteria[key] = value;
  }
  return criteria;
};

export async function createReview(req, res) {
  try {
    const reviewerId = getUserId(req);
    const { applicationId, rating, comment = '', criteria = {} } = req.body || {};
    const ratingValue = Number(rating);

    if (!applicationId) return res.status(400).json({ message: 'Application is required.' });
    if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({ message: 'Rating must be a whole number from 1 to 5.' });
    }
    if (typeof comment !== 'string' || comment.trim().length > 2000) {
      return res.status(400).json({ message: 'Review comment must be 2000 characters or fewer.' });
    }

    const application = await JobApplication.findById(applicationId).populate('job');
    if (!application || !application.job) {
      return res.status(404).json({ message: 'Completed job relationship not found.' });
    }
    if (!HIRED_STATUSES.has(application.status)) {
      return res.status(403).json({ message: 'Only hired workers and their employer can leave a review.' });
    }
    if (application.job.status !== 'Completed') {
      return res.status(403).json({ message: 'Reviews become available after the job is completed.' });
    }

    const employerId = String(application.job.jobPoster || '');
    const workerId = String(application.applicant || '');
    const requesterId = String(reviewerId || '');
    let reviewee;
    let reviewerRole;
    let revieweeRole;

    if (requesterId === employerId) {
      reviewee = workerId;
      reviewerRole = 'employer';
      revieweeRole = 'worker';
    } else if (requesterId === workerId) {
      reviewee = employerId;
      reviewerRole = 'worker';
      revieweeRole = 'employer';
    } else {
      return res.status(403).json({ message: 'You did not participate in this completed job.' });
    }
    if (!reviewee || requesterId === String(reviewee)) {
      return res.status(400).json({ message: 'You cannot review yourself.' });
    }

    const review = await Review.create({
      job: application.job._id,
      application: application._id,
      reviewer: reviewerId,
      reviewee,
      reviewerRole,
      revieweeRole,
      rating: ratingValue,
      comment: comment.trim(),
      criteria: sanitizeCriteria(criteria),
    });

    try {
      await createNotification({
        userId: reviewee,
        type: 'achievement',
        title: 'New review received',
        message: `You received a ${ratingValue}-star review for ${application.job.title || 'a completed job'}.`,
        link: `/profiles/${reviewee}?viewAs=${revieweeRole}`,
        entityType: 'job',
        entityId: application.job._id,
        actor: reviewerId,
        push: true,
        socketPayload: { reviewId: String(review._id), jobId: String(application.job._id) },
      });
    } catch (notificationError) {
      console.warn('Review notification failed:', notificationError?.message || notificationError);
    }

    const populated = await Review.findById(review._id)
      .populate('reviewer', 'firstName lastName companyName avatarUrl')
      .populate('job', 'title');
    const summary = await getReviewSummary(reviewee, revieweeRole);
    return res.status(201).json({ message: 'Review submitted successfully.', review: serializeReview(populated, reviewerId), summary });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'You have already reviewed this completed job.' });
    }
    console.error('Create review error:', error);
    return res.status(500).json({ message: 'Failed to submit review.' });
  }
}

export async function getUserReviews(req, res) {
  try {
    const { userId } = req.params;
    const revieweeRole = req.query?.as === 'employer' ? 'employer' : 'worker';
    const sort = ['recent', 'highest', 'lowest', 'helpful'].includes(req.query?.sort)
      ? req.query.sort
      : 'recent';
    const page = Math.max(1, Math.floor(Number(req.query?.page) || 1));
    const limit = Math.min(50, Math.max(1, Math.floor(Number(req.query?.limit) || 20)));
    if (!mongoose.Types.ObjectId.isValid(String(userId || ''))) {
      return res.status(400).json({ message: 'Valid profile id is required.' });
    }
    const reviewFilter = { reviewee: userId, revieweeRole };
    const skip = (page - 1) * limit;
    const findReviews = async () => {
      if (sort === 'helpful') {
        const rows = await Review.aggregate([
          {
            $match: {
              reviewee: new mongoose.Types.ObjectId(String(userId)),
              revieweeRole,
            },
          },
          {
            $addFields: {
              helpfulScore: {
                $subtract: [
                  { $size: { $ifNull: ['$likedBy', []] } },
                  { $size: { $ifNull: ['$dislikedBy', []] } },
                ],
              },
              helpfulLikes: { $size: { $ifNull: ['$likedBy', []] } },
            },
          },
          { $sort: { helpfulScore: -1, helpfulLikes: -1, createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          { $unset: ['helpfulScore', 'helpfulLikes'] },
        ]);
        return Review.populate(rows, [
          { path: 'reviewer', select: 'firstName lastName companyName avatarUrl' },
          { path: 'job', select: 'title category' },
        ]);
      }

      const databaseSort = sort === 'highest'
        ? { rating: -1, createdAt: -1 }
        : sort === 'lowest'
          ? { rating: 1, createdAt: -1 }
          : { createdAt: -1 };
      return Review.find(reviewFilter)
        .populate('reviewer', 'firstName lastName companyName avatarUrl')
        .populate('job', 'title category')
        .sort(databaseSort)
        .skip(skip)
        .limit(limit);
    };

    const [summary, total, reviews] = await Promise.all([
      getReviewSummary(userId, revieweeRole),
      Review.countDocuments(reviewFilter),
      findReviews(),
    ]);

    const serialized = reviews.map((review) => serializeReview(review, getUserId(req)));
    return res.status(200).json({
      summary,
      reviews: serialized,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + serialized.length < total,
      },
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    return res.status(500).json({ message: 'Failed to load reviews.' });
  }
}

export async function reactToReview(req, res) {
  try {
    const userId = getUserId(req);
    const { reviewId } = req.params;
    const reaction = req.body?.reaction ?? null;

    if (!mongoose.Types.ObjectId.isValid(String(reviewId || ''))) {
      return res.status(400).json({ message: 'Valid review id is required.' });
    }
    if (!['like', 'dislike', null].includes(reaction)) {
      return res.status(400).json({ message: 'Reaction must be like, dislike, or null.' });
    }

    const userObjectId = new mongoose.Types.ObjectId(String(userId));
    const removeUser = (field) => ({
      $setDifference: [{ $ifNull: [`$${field}`, []] }, [userObjectId]],
    });
    const cleanLikes = removeUser('likedBy');
    const cleanDislikes = removeUser('dislikedBy');
    const review = await Review.findOneAndUpdate(
      { _id: reviewId },
      [
      {
        $set: {
          likedBy: reaction === 'like' ? { $concatArrays: [cleanLikes, [userObjectId]] } : cleanLikes,
          dislikedBy: reaction === 'dislike' ? { $concatArrays: [cleanDislikes, [userObjectId]] } : cleanDislikes,
        },
      },
      ],
      { returnDocument: 'after', updatePipeline: true },
    );
    if (!review) return res.status(404).json({ message: 'Review not found.' });
    await review.populate('reviewer', 'firstName lastName companyName avatarUrl');
    await review.populate('job', 'title category');

    return res.status(200).json({
      message: reaction ? `Review ${reaction} saved.` : 'Review reaction removed.',
      review: serializeReview(review, userId),
    });
  } catch (error) {
    console.error('Review reaction error:', error);
    return res.status(500).json({ message: 'Failed to update review reaction.' });
  }
}

export async function replyToReview(req, res) {
  try {
    const userId = getUserId(req);
    const { reviewId } = req.params;
    const reply = req.body?.reply;

    if (!mongoose.Types.ObjectId.isValid(String(reviewId || ''))) {
      return res.status(400).json({ message: 'Valid review id is required.' });
    }
    if (typeof reply !== 'string' || !reply.trim() || reply.trim().length > 2000) {
      return res.status(400).json({ message: 'Reply must contain 1 to 2000 characters.' });
    }

    const review = await Review.findById(reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found.' });
    if (String(review.reviewee) !== String(userId)) {
      return res.status(403).json({ message: 'Only the profile owner can reply to this review.' });
    }

    review.ownerReply = reply.trim();
    review.ownerReplyAt = new Date();
    await review.save();

    try {
      await createNotification({
        userId: review.reviewer,
        type: 'achievement',
        title: 'Reply to your review',
        message: 'The profile owner replied to your review.',
        link: `/profiles/${review.reviewee}?viewAs=${review.revieweeRole}`,
        entityType: 'review',
        entityId: review._id,
        actor: userId,
        push: true,
        socketPayload: { reviewId: String(review._id) },
      });
    } catch (notificationError) {
      console.warn('Review reply notification failed:', notificationError?.message || notificationError);
    }

    const populated = await Review.findById(reviewId)
      .populate('reviewer', 'firstName lastName companyName avatarUrl')
      .populate('job', 'title category');
    return res.status(200).json({
      message: 'Reply saved successfully.',
      review: serializeReview(populated, userId),
    });
  } catch (error) {
    console.error('Review reply error:', error);
    return res.status(500).json({ message: 'Failed to save review reply.' });
  }
}

export async function getEligibleReviews(req, res) {
  try {
    const userId = getUserId(req);
    const [workerApplications, employerApplications, existingReviews] = await Promise.all([
      JobApplication.find({ applicant: userId, status: { $in: [...HIRED_STATUSES] } })
        .populate({ path: 'job', match: { status: 'Completed' }, populate: { path: 'jobPoster', select: 'firstName lastName companyName avatarUrl' } })
        .sort({ updatedAt: -1 }),
      JobApplication.find({ status: { $in: [...HIRED_STATUSES] } })
        .populate({ path: 'job', match: { jobPoster: userId, status: 'Completed' } })
        .populate('applicant', 'firstName lastName jobPosition avatarUrl')
        .sort({ updatedAt: -1 }),
      Review.find({ reviewer: userId }).select('application rating comment createdAt').lean(),
    ]);
    const reviewByApplication = new Map(existingReviews.map((review) => [String(review.application), review]));

    const asWorker = workerApplications.filter((item) => item.job).map((item) => ({
      applicationId: String(item._id),
      job: item.job,
      reviewee: item.job.jobPoster,
      existingReview: reviewByApplication.get(String(item._id)) || null,
      canReview: !reviewByApplication.has(String(item._id)),
    }));
    const asEmployer = employerApplications.filter((item) => item.job).map((item) => ({
      applicationId: String(item._id),
      job: item.job,
      reviewee: item.applicant,
      existingReview: reviewByApplication.get(String(item._id)) || null,
      canReview: !reviewByApplication.has(String(item._id)),
    }));

    return res.status(200).json({ asWorker, asEmployer });
  } catch (error) {
    console.error('Get eligible reviews error:', error);
    return res.status(500).json({ message: 'Failed to load review eligibility.' });
  }
}
