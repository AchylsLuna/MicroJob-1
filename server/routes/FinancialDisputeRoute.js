import { Router } from 'express';
import auth from '../middleware/auth.js';
import { uploadDisputeEvidenceFile } from '../middleware/uploadConfig.js';
import {
  addFinancialDisputeEvidence,
  addFinancialDisputeMessage,
  getFinancialDispute,
  listMyFinancialDisputes,
  submitEmployerResponse,
  submitFinancialDisputeAppeal,
} from '../controllers/FinancialDisputeController.js';

const router = Router();

router.use(auth);
router.get('/', listMyFinancialDisputes);
router.get('/:disputeId', getFinancialDispute);
router.post('/:disputeId/evidence', uploadDisputeEvidenceFile, addFinancialDisputeEvidence);
router.post('/:disputeId/messages', addFinancialDisputeMessage);
router.post('/:disputeId/employer-response', submitEmployerResponse);
router.post('/:disputeId/appeal', submitFinancialDisputeAppeal);

export default router;
