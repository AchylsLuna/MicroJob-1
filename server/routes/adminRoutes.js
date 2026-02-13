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
    getWorkersCount,
    getEmployersCount,
    getJobsCount,
    getAvailableJobsCount,
    getInProgressJobsCount,
    getCancelledJobsCount,
    getCompletedJobsCount,
} from '../controllers/adminController.js';

const router = express.Router();

//routes to get all jobs
router.get('/all-jobs', getAllJobs);
router.get('/all-available-jobs', getAllAvailableJobs);
router.get('/all-completed-jobs', getAllCompletedJobs);
router.get('/all-inprogress-jobs', getAllInProgressJobs);
router.get('/all-cancelled-jobs', getAllCancelledJobs);

//route to get job details
router.get('/job-details/:id', getJobDetails);
router.patch('/job-details/:id', updateJobDetails);
//route to get all users
router.get('/all-users', getAllUsers);
router.get('/both-users', getBothUsers);
router.get('/all-workers', getAllWorkers);
router.get('/all-employers', getAllEmployers);
router.get('/all-admins', getAllAdmins);

//route to get user details && update details
router.get('/user-details/:id', getUserDetails);
router.patch('/user-details/:id', patchUserDetails);

//analytics routes
router.get('/analytics/workers-count', getWorkersCount);
router.get('/analytics/employers-count', getEmployersCount);
router.get('/analytics/jobs-count', getJobsCount);
router.get('/analytics/available-jobs-count', getAvailableJobsCount);
router.get('/analytics/inprogress-jobs-count', getInProgressJobsCount);
router.get('/analytics/cancelled-jobs-count', getCancelledJobsCount);
router.get('/analytics/completed-jobs-count', getCompletedJobsCount);


export default router;