import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import csrfProtection from '../middleware/csrf.js';
import verifyToken from '../middleware/auth.js';
import {
  sendOtp,
  verifyOtp,
  updateMe,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithOtp,
  requestPasswordChangeOtp,
  changePasswordWithOtp,
  requestSelfDelete,
  changeInitialPassword,
} from '../controllers/UserController.js';
import {
  registerUser,
  loginUser,
  loginMfa,
  loginOtpVerify,
  loginOtpResend,
} from '../controllers/AuthController.js';
import {
  refreshSession,
  listSessions,
  revokeSession,
  revokeAllSessions,
  cleanupSessions,
  adminListSessions,
  logout,
} from '../controllers/SessionController.js';
import {
  getMfaStatus,
  setupMfa,
  enableMfa,
  disableMfa,
  regenerateBackupCodes,
} from '../controllers/MfaController.js';
import {
  uploadAvatarFile,
  uploadResumeFile,
  uploadVerificationFile,
  hasValidResumeFileSignature,
  hasValidAvatarFileSignature,
  hasValidVerificationFileSignature,
} from '../middleware/uploadConfig.js';
export {
  hasValidResumeFileSignature,
  hasValidAvatarFileSignature,
  hasValidVerificationFileSignature,
} from '../middleware/uploadConfig.js';
export { normalizeExperience } from '../controllers/ProfileController.js';
import {
  registerLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  passwordResetRequestLimiter,
  passwordResetConfirmLimiter,
  passwordChangeLimiter,
  verificationPhoneSendLimiter,
  verificationPhoneConfirmLimiter,
  loginLimiter,
} from '../lib/rateLimiters.js';
import {
  getVerificationStatus,
  sendPhoneVerification,
  confirmPhoneVerification,
  uploadIdentityDocument,
  uploadAddressDocument,
} from '../controllers/verificationController.js';

const router = express.Router();

router.post('/register', registerLimiter, registerUser);
router.post('/otp/send', otpSendLimiter, sendOtp);
router.post('/otp/verify', otpVerifyLimiter, verifyOtp);
router.post('/password-reset/request', passwordResetRequestLimiter, requestPasswordResetOtp);
router.post('/password-reset/verify', passwordResetConfirmLimiter, verifyPasswordResetOtp);
router.post('/password-reset/confirm', passwordResetConfirmLimiter, resetPasswordWithOtp);
router.post('/password-change/request', verifyToken, passwordChangeLimiter, requestPasswordChangeOtp);
router.post('/password-change/confirm', verifyToken, passwordChangeLimiter, changePasswordWithOtp);
router.post('/password/initial-change', verifyToken, passwordChangeLimiter, changeInitialPassword);
router.post('/login', loginLimiter, loginUser);
router.post('/login/mfa', loginLimiter, loginMfa);
router.post('/login/otp/verify', loginLimiter, loginOtpVerify);
router.post('/login/otp/resend', loginLimiter, loginOtpResend);
router.post('/refresh', csrfProtection, refreshSession);
router.get('/sessions', verifyToken, listSessions);
router.delete('/sessions/:id', verifyToken, revokeSession);
router.delete('/sessions', verifyToken, revokeAllSessions);
router.post('/sessions/cleanup', verifyToken, cleanupSessions);
router.get('/admin/sessions/:userId', verifyToken, adminListSessions);
router.get('/mfa/status', verifyToken, getMfaStatus);
router.post('/mfa/setup', verifyToken, setupMfa);
router.post('/mfa/enable', verifyToken, enableMfa);
router.post('/mfa/disable', verifyToken, disableMfa);
router.post('/mfa/backup-codes/regenerate', verifyToken, regenerateBackupCodes);
router.post('/logout', verifyToken, logout);

// Verification endpoints
router.get('/verification/status', verifyToken, getVerificationStatus);
router.post('/verification/phone', verifyToken, verificationPhoneSendLimiter, sendPhoneVerification);
router.post('/verification/phone/confirm', verifyToken, verificationPhoneConfirmLimiter, confirmPhoneVerification);
router.post('/verification/documents/identity', verifyToken, uploadVerificationFile, uploadIdentityDocument);
router.post('/verification/documents/address', verifyToken, uploadVerificationFile, uploadAddressDocument);

export default router;
