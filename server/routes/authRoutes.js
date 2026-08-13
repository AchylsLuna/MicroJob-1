import express from 'express';
import csrfProtection from '../middleware/csrf.js';
import { isNativeAuthRequest } from '../lib/authSession.js';
import verifyToken from '../middleware/auth.js';
import {
  sendOtp,
  verifyOtp,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithOtp,
  requestPasswordChangeOtp,
  changePasswordWithOtp,
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
import { uploadVerificationFile } from '../middleware/uploadConfig.js';
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

export {
  hasValidResumeFileSignature,
  hasValidAvatarFileSignature,
  hasValidVerificationFileSignature,
} from '../middleware/uploadConfig.js';
export { normalizeExperience } from '../lib/profileValidation.js';

const router = express.Router();
const protectRefresh = (req, res, next) => {
  if (isNativeAuthRequest(req) && !req.cookies?.refreshToken && req.body?.refreshToken) return next();
  return csrfProtection(req, res, next);
};

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

router.post('/refresh', protectRefresh, refreshSession);
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

router.get('/verification/status', verifyToken, getVerificationStatus);
router.post('/verification/phone', verifyToken, verificationPhoneSendLimiter, sendPhoneVerification);
router.post('/verification/phone/confirm', verifyToken, verificationPhoneConfirmLimiter, confirmPhoneVerification);
router.post('/verification/documents/identity', verifyToken, uploadVerificationFile, uploadIdentityDocument);
router.post('/verification/documents/address', verifyToken, uploadVerificationFile, uploadAddressDocument);

export default router;
