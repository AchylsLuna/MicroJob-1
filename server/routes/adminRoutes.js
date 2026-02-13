import express from 'express';
import {
    getAllJobs,
    getAllAvailableJobs,
    getAllCompletedJobs,
    getAllInProgressJobs,
    getAllCancelledJobs,
    getJobDetails,
    updateJobDetails,
    getAllUsers,
    getAllWorkers,
    getAllEmployers, 
    getBothUsers,
    getAllAdmins,
    getUserDetails,
    patchUserDetails,
    getUserCount,
    getJobsCount,
} from '../controllers/adminController.js';
import verifyToken from '../middleware/auth.js';

const router = express.Router();

//routes to get all jobs
router.get('/all-jobs', verifyToken, getAllJobs);
router.get('/all-available-jobs', verifyToken, getAllAvailableJobs);
router.get('/all-completed-jobs', verifyToken, getAllCompletedJobs);
router.get('/all-inprogress-jobs', verifyToken, getAllInProgressJobs);
router.get('/all-cancelled-jobs', verifyToken, getAllCancelledJobs);

//route to get job details
router.get('/job-details/:id', verifyToken, getJobDetails);
router.patch('/job-details/:id', verifyToken, updateJobDetails);
//route to get all users
router.get('/all-users', verifyToken, getAllUsers);
router.get('/both-users', verifyToken, getBothUsers);
router.get('/all-workers', verifyToken, getAllWorkers);
router.get('/all-employers', verifyToken, getAllEmployers);
router.get('/all-admins', verifyToken, getAllAdmins);

//route to get user details && update details
router.get('/user-details/:id', verifyToken, getUserDetails);
router.patch('/user-details/:id', verifyToken, patchUserDetails);

//analytics routes
router.get('/analytics/users-count', verifyToken, getUserCount);
router.get('/analytics/jobs-count', verifyToken, getJobsCount);


export default router;