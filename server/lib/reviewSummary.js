import mongoose from 'mongoose';
import Review from '../models/Review.js';

export async function getReviewSummary(revieweeId, revieweeRole) {
  const emptySummary = {
    averageRating: 0,
    totalReviews: 0,
    percentage: 0,
    ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  };
  if (!mongoose.Types.ObjectId.isValid(String(revieweeId || ''))) {
    return emptySummary;
  }

  const [summary] = await Review.aggregate([
    {
      $match: {
        reviewee: new mongoose.Types.ObjectId(String(revieweeId)),
        revieweeRole,
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        fiveStars: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
        fourStars: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        threeStars: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        twoStars: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        oneStar: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
      },
    },
  ]);

  const averageRating = Number(Number(summary?.averageRating || 0).toFixed(1));
  return {
    averageRating,
    totalReviews: Number(summary?.totalReviews || 0),
    percentage: Math.round(averageRating * 20),
    ratingBreakdown: {
      5: Number(summary?.fiveStars || 0),
      4: Number(summary?.fourStars || 0),
      3: Number(summary?.threeStars || 0),
      2: Number(summary?.twoStars || 0),
      1: Number(summary?.oneStar || 0),
    },
  };
}

export async function getReviewSummaries(revieweeIds, revieweeRole) {
  const validIds = [...new Set(revieweeIds.map(String))]
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!validIds.length) return new Map();

  const rows = await Review.aggregate([
    { $match: { reviewee: { $in: validIds }, revieweeRole } },
    {
      $group: {
        _id: '$reviewee',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  return new Map(rows.map((row) => [String(row._id), {
    averageRating: Number(Number(row.averageRating || 0).toFixed(1)),
    totalReviews: Number(row.totalReviews || 0),
  }]));
}
