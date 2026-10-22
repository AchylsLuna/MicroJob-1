import express from 'express';
import { cancelAssignment, respondToCancellation, startWork, getAssignmentLifecycle, openDispute } from '../controllers/LifecycleController.js';
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
  restoreEmployerApplication,
  deleteEmployerApplication,
  scheduleInterview,
  updateInterview,
} from '../controllers/JobApplicationController.js';
import { authorizePayment, openPaymentDispute, previewPayment, requestChanges, settleDirect, submitWork } from '../controllers/ApplicationPaymentController.js';
import { cancelJobOffer, confirmOfferHire, createJobOffer, respondToJobOffer } from '../controllers/JobOfferController.js';
import authenticateToken from '../middleware/auth.js';
import { uploadCompletionEvidenceFile } from '../middleware/uploadConfig.js';
import { updateHireChecklistItem } from '../controllers/HireChecklistController.js';

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
router.patch('/applications/:applicationId/employer/restore', authenticateToken, restoreEmployerApplication);
router.delete('/applications/:applicationId/employer', authenticateToken, deleteEmployerApplication);
router.patch('/applications/:applicationId/applicant/read', authenticateToken, markApplicantApplicationRead);
router.post('/applications/:applicationId/offers', authenticateToken, createJobOffer);
router.post('/job-offers/:offerId/respond', authenticateToken, respondToJobOffer);
router.post('/job-offers/:offerId/cancel', authenticateToken, cancelJobOffer);
router.post('/job-offers/:offerId/confirm-hire', authenticateToken, confirmOfferHire);
router.patch('/applications/:applicationId/checklist/:itemId', authenticateToken, updateHireChecklistItem);
router.post('/applications/:applicationId/payment/preview', authenticateToken, previewPayment);
router.post('/applications/:applicationId/payment/authorize', authenticateToken, authorizePayment);
router.post('/applications/:applicationId/work/submit', authenticateToken, uploadCompletionEvidenceFile, submitWork);
router.post('/applications/:applicationId/work/request-changes', authenticateToken, requestChanges);
router.post('/applications/:applicationId/payment/disputes', authenticateToken, openPaymentDispute);
router.post('/applications/:applicationId/payment/settle', authenticateToken, settleDirect);

router.get('/applications/:applicationId/lifecycle', authenticateToken, getAssignmentLifecycle);
router.post('/applications/:applicationId/work/start', authenticateToken, startWork);
router.post('/applications/:applicationId/cancel', authenticateToken, cancelAssignment);
router.post('/cancellations/:id/respond', authenticateToken, respondToCancellation);
router.post('/applications/:applicationId/disputes', authenticateToken, openDispute);
export default router;
