import express from 'express';
import { 
    getJobList, 
    getAvailableJobs, 
    getJobByCategory, 
    getJobDetails, 
    getApplicantsList, 
    createJob, 
    changeJobStatus, 
    selectApplicant,
    getMyJobs,
    updateJob,
    deleteJob,
    reopenJob
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
router.get('/:id', getJobDetails);

router.post('/', verifyToken, createJob);
router.put('/:id', verifyToken, updateJob);
router.get('/:jobId/applicants', verifyToken, getApplicantsList);
router.patch('/:jobId/select/:applicantId', verifyToken, selectApplicant);
router.patch('/:id/status', verifyToken, changeJobStatus);
router.patch('/:id/reopen', verifyToken, reopenJob);
router.delete('/:id', verifyToken, deleteJob);

export default router;
