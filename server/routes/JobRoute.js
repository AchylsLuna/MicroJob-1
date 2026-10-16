import express from 'express';
import { cancelPosting } from '../controllers/LifecycleController.js';
import { 
    getJobList, 
    getAvailableJobs, 
    getJobByCategory, 
    getJobDetails, 
    getApplicantsList, 
    createJob, 
    changeJobStatus, 
    getMyJobs,
    getEmployerJobHistory,
    updateJob,
    deleteJob,
    reopenJob,
    repostJob
} from '../controllers/JobController.js'; 
import { getRecommendedJobs } from '../controllers/JobRecommendationController.js';

import verifyToken from '../middleware/auth.js';
import optionalAuth from '../middleware/optionalAuth.js';

const router = express.Router();

router.get('/', optionalAuth, getJobList);
router.get('/available', optionalAuth, getAvailableJobs);
router.get('/recommended', verifyToken, getRecommendedJobs);
router.get('/category/:categoryId', optionalAuth, getJobByCategory);
router.get('/mine', verifyToken, getMyJobs);
router.get('/history', verifyToken, getEmployerJobHistory);
router.get('/:id', optionalAuth, getJobDetails);

router.post('/', verifyToken, createJob);
router.put('/:id', verifyToken, updateJob);
router.get('/:jobId/applicants', verifyToken, getApplicantsList);
router.patch('/:id/status', verifyToken, changeJobStatus);
router.patch('/:id/reopen', verifyToken, reopenJob);
router.post('/:id/repost', verifyToken, repostJob);
router.post('/:id/cancel', verifyToken, cancelPosting);
router.delete('/:id', verifyToken, deleteJob);

export default router;
