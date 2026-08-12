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
  hideEmployerApplication,
  deleteEmployerApplication,
  scheduleInterview,
  updateInterview,
} from '../controllers/JobApplicationController.js';
import { authorizePayment, requestChanges, settleDirect, submitWork } from '../controllers/ApplicationPaymentController.js';
import { cancelJobOffer, confirmOfferHire, createJobOffer, respondToJobOffer } from '../controllers/JobOfferController.js';
import authenticateToken from '../middleware/auth.js';

const router = express.Router();

router.post('/jobs/:jobId/apply', authenticateToken, applyForJob);
router.get('/applications', authenticateToken, getUserApplications);
router.get('/applications/employer', authenticateToken, getEmployerApplications);
router.get('/applications/:applicationId', authenticateToken, getApplicationById);
router.delete('/applications/:applicationId', authenticateToken, withdrawApplication);
router.put('/applications/:applicationId/status', authenticateToken, updateApplicationStatus);
router.post('/applications/:applicationId/interviews', authenticateToken, scheduleInterview);
router.patch('/applications/:applicationId/interviews/:interviewId', authenticateToken, updateInterview);
router.patch('/applications/:applicationId/employer/read', authenticateToken, markEmployerApplicationRead);
router.patch('/applications/:applicationId/employer/remove', authenticateToken, hideEmployerApplication);
router.delete('/applications/:applicationId/employer', authenticateToken, deleteEmployerApplication);
router.patch('/applications/:applicationId/applicant/read', authenticateToken, markApplicantApplicationRead);
router.post('/applications/:applicationId/offers', authenticateToken, createJobOffer);
router.post('/job-offers/:offerId/respond', authenticateToken, respondToJobOffer);
router.post('/job-offers/:offerId/cancel', authenticateToken, cancelJobOffer);
router.post('/job-offers/:offerId/confirm-hire', authenticateToken, confirmOfferHire);
router.post('/applications/:applicationId/payment/authorize', authenticateToken, authorizePayment);
router.post('/applications/:applicationId/work/submit', authenticateToken, submitWork);
router.post('/applications/:applicationId/work/request-changes', authenticateToken, requestChanges);
router.post('/applications/:applicationId/payment/settle', authenticateToken, settleDirect);

export default router;
