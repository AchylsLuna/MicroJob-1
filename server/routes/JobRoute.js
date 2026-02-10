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
    updateJob
} from '../controllers/JobController.js'; 

import verifyToken from '../middleware/auth.js';

const router = express.Router();

router.get('/', getJobList); 
router.get('/available', getAvailableJobs);
router.get('/category/:categoryId', getJobByCategory);
router.get('/mine', verifyToken, getMyJobs);
router.get('/:id', getJobDetails);

router.post('/', verifyToken, createJob);
router.put('/:id', verifyToken, updateJob);
router.get('/:jobId/applicants', verifyToken, getApplicantsList);
router.patch('/:jobId/select/:applicantId', verifyToken, selectApplicant);
router.patch('/:id/status', verifyToken, changeJobStatus);

export default router;