import express from 'express';
import {
    applyForJob,
    getUserApplications,
    getApplicationById,
    withdrawApplication,
    updateApplicationStatus,
    getEmployerApplications,
    markEmployerApplicationRead,
    markApplicantApplicationRead,
    hideEmployerApplication
} from '../controllers/JobApplicationController.js';
import authenticateToken from '../middleware/auth.js';

const router = express.Router();

// Apply for a job
router.post('/jobs/:jobId/apply', authenticateToken, applyForJob);

// Get all applications for logged-in user
router.get('/applications', authenticateToken, getUserApplications);

// Get all applications for employer's jobs
router.get('/applications/employer', authenticateToken, getEmployerApplications);

// Get specific application
router.get('/applications/:applicationId', authenticateToken, getApplicationById);

// Withdraw application
router.delete('/applications/:applicationId', authenticateToken, withdrawApplication);

// Update application status (for employers)
router.put('/applications/:applicationId/status', authenticateToken, updateApplicationStatus);

// Employer notification actions
router.patch('/applications/:applicationId/employer/read', authenticateToken, markEmployerApplicationRead);
router.patch('/applications/:applicationId/employer/remove', authenticateToken, hideEmployerApplication);
// Applicant notification actions
router.patch('/applications/:applicationId/applicant/read', authenticateToken, markApplicantApplicationRead);

export default router;
