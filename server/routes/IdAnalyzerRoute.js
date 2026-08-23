import express from 'express';
import verifyToken from '../middleware/auth.js';
import {
  confirmIdVerification,
  discardIdVerification,
  verifyIdDocument,
} from '../controllers/IdAnalyzerController.js';
import { memoryUpload, scanLimiter } from '../models/IdAnalyzerModel.js';

const router = express.Router();

router.post('/verify', verifyToken, scanLimiter, memoryUpload.single('document'), verifyIdDocument);
router.post('/confirm', verifyToken, confirmIdVerification);
router.post('/discard', verifyToken, discardIdVerification);

export default router;
