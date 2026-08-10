import express from 'express';
import verifyToken from '../middleware/auth.js';
import {
  createReview,
  getEligibleReviews,
  getUserReviews,
  reactToReview,
  replyToReview,
} from '../controllers/ReviewController.js';

const router = express.Router();

router.get('/eligible', verifyToken, getEligibleReviews);
router.get('/user/:userId', verifyToken, getUserReviews);
router.post('/', verifyToken, createReview);
router.put('/:reviewId/reaction', verifyToken, reactToReview);
router.patch('/:reviewId/reply', verifyToken, replyToReview);

export default router;
