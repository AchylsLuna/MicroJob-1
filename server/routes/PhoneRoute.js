import express from 'express';
import verifyToken from '../middleware/auth.js';
import {
    sendPhoneCode,
    verifyPhoneCode,
} from '../controllers/PhoneVerificationController.js';

const router = express.Router();

router.post('/send-code', verifyToken, sendPhoneCode);
router.post('/verify-code', verifyToken, verifyPhoneCode);

export default router;