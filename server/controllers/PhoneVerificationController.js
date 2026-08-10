import {
  confirmPhoneVerification,
  sendPhoneVerification,
} from './verificationController.js';

// Compatibility wrappers for the legacy /api/verify-phone routes. Both route
// families now use the same provider configuration, hashed database record,
// cooldown, expiry, and attempt limits.
export const sendPhoneCode = (req, res) => sendPhoneVerification(req, res);

export const verifyPhoneCode = (req, res) =>
  confirmPhoneVerification(
    {
      ...req,
      user: req.user,
      body: {
        ...(req.body || {}),
        code: req.body?.code || req.body?.otp,
      },
    },
    res,
  );
