import express from 'express';
import csrfProtection from '../middleware/csrf.js';
import { isBearerAuthRequest, isNativeAuthRequest } from '../lib/authSession.js';
import verifyToken from '../middleware/auth.js';
import { getSecondaryEmail, requestSecondaryEmailOtp, confirmSecondaryEmailOtp } from '../controllers/StaffSecondaryEmailController.js';
import requireAdmin, { requirePermission } from '../middleware/admin.js';
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
  loginTrustedDevice,
  selectLoginMethod,
  googleLogin,
  loginMfa,
  loginOtpVerify,
  loginOtpResend,
  debugLoginOtp,
  debugSignupOtp,
  debugCreditWallet,
} from '../controllers/AuthController.js';
import {
  refreshSession,
  listSessions,
  revokeSession,
  revokeAllSessions,
  cleanupSessions,
  listTrustedDevices,
  revokeTrustedDevice,
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
  registerIpLimiter,
  otpSendLimiter,
  otpSendIpLimiter,
  otpVerifyLimiter,
  passwordResetRequestLimiter,
  passwordResetConfirmLimiter,
  passwordChangeLimiter,
  secondaryEmailSendLimiter,
  secondaryEmailConfirmLimiter,
  verificationPhoneSendLimiter,
  verificationPhoneConfirmLimiter,
  loginLimiter,
  accountLoginLimiter,
} from '../lib/rateLimiters.js';
import {
  getVerificationStatus,
  sendPhoneVerification,
  confirmPhoneVerification,
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
  const isMobileRefresh = (isNativeAuthRequest(req) || isBearerAuthRequest(req))
    && !req.cookies?.refreshToken
    && typeof req.body?.refreshToken === 'string'
    && req.body.refreshToken.trim().length > 0;
  if (isMobileRefresh) return next();
  return csrfProtection(req, res, next);
};

router.post('/register', registerIpLimiter, registerLimiter, registerUser);
router.post('/otp/send', otpSendIpLimiter, otpSendLimiter, sendOtp);
router.post('/otp/verify', otpVerifyLimiter, verifyOtp);
router.post('/password-reset/request', passwordResetRequestLimiter, requestPasswordResetOtp);
router.post('/password-reset/verify', passwordResetConfirmLimiter, verifyPasswordResetOtp);
router.post('/password-reset/confirm', passwordResetConfirmLimiter, resetPasswordWithOtp);
router.post('/password-change/request', verifyToken, passwordChangeLimiter, requestPasswordChangeOtp);
router.post('/password-change/confirm', verifyToken, passwordChangeLimiter, changePasswordWithOtp);
router.get('/secondary-email', verifyToken, requireAdmin, getSecondaryEmail);
router.post('/secondary-email/request', verifyToken, requireAdmin, secondaryEmailSendLimiter, requestSecondaryEmailOtp);
router.post('/secondary-email/confirm', verifyToken, requireAdmin, secondaryEmailConfirmLimiter, confirmSecondaryEmailOtp);
router.post('/password/initial-change', verifyToken, passwordChangeLimiter, changeInitialPassword);

// Two ceilings on every login entry point: loginLimiter caps attempts per
// IP+account pair, accountLoginLimiter caps them per account regardless of
// source address. The pair closes both password spraying and distributed
// credential stuffing -- see lib/rateLimiters.js.
router.post('/login', loginLimiter, accountLoginLimiter, loginUser);
router.post('/login/trusted-device', loginLimiter, loginTrustedDevice);
router.post('/login/method', loginLimiter, accountLoginLimiter, selectLoginMethod);
router.post('/google', loginLimiter, googleLogin);
router.post('/login/mfa', loginLimiter, accountLoginLimiter, loginMfa);
router.post('/login/otp/verify', loginLimiter, accountLoginLimiter, loginOtpVerify);
// otpSendLimiter as well as the login pair: resending mints a new code and a
// new email, so it is a send endpoint, and it was previously the one way to
// keep re-rolling a challenge without any per-send ceiling.
router.post('/login/otp/resend', loginLimiter, accountLoginLimiter, otpSendLimiter, loginOtpResend);
// 404s outside NODE_ENV === 'test' (see AuthController.debugLoginOtp) -- the
// e2e harness's only way to read a code it can never see in a real response.
router.get('/debug/login-otp', debugLoginOtp);
// Same gate: the signup/email-verification code, which used to be echoed in the
// /otp/send response body on every non-production deploy.
router.get('/debug/signup-otp', debugSignupOtp);
// Same gate: credits an employer wallet so the e2e suite can exercise the
// offer -> hire -> settle path without a real PayMongo checkout.
router.post('/debug/credit-wallet', debugCreditWallet);

router.post('/refresh', protectRefresh, refreshSession);
router.get('/sessions', verifyToken, listSessions);
router.delete('/sessions/:id', verifyToken, revokeSession);
router.delete('/sessions', verifyToken, revokeAllSessions);
router.post('/sessions/cleanup', verifyToken, cleanupSessions);
router.get('/trusted-devices', verifyToken, listTrustedDevices);
router.delete('/trusted-devices/:id', verifyToken, revokeTrustedDevice);
router.get('/admin/sessions/:userId', verifyToken, requireAdmin, requirePermission('audit.view'), adminListSessions);

router.get('/mfa/status', verifyToken, getMfaStatus);
router.post('/mfa/setup', verifyToken, setupMfa);
router.post('/mfa/enable', verifyToken, enableMfa);
router.post('/mfa/disable', verifyToken, disableMfa);
router.post('/mfa/backup-codes/regenerate', verifyToken, regenerateBackupCodes);
router.post('/logout', verifyToken, logout);

router.get('/verification/status', verifyToken, getVerificationStatus);
router.post('/verification/phone', verifyToken, verificationPhoneSendLimiter, sendPhoneVerification);
router.post('/verification/phone/confirm', verifyToken, verificationPhoneConfirmLimiter, confirmPhoneVerification);
router.post('/verification/documents/address', verifyToken, uploadVerificationFile, uploadAddressDocument);

export default router;
