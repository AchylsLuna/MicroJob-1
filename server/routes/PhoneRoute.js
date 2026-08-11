import express from 'express';
import verifyToken from '../middleware/auth.js';
import {
    sendPhoneCode,
    resendPhoneCode,
    verifyPhoneCode,
} from '../controllers/PhoneVerificationController.js';

const router = express.Router();

router.post('/send-code', verifyToken, sendPhoneCode);
router.post('/resend-code', verifyToken, resendPhoneCode);
router.post('/verify-code', verifyToken, verifyPhoneCode);

export default router;