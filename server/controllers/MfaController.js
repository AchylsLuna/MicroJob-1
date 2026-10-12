import User from '../models/User.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import {
  generateBackupCodes,
  hashBackupCodes,
  mfaStatusPayload,
  MFA_METHOD,
  verifyMfaCodeForUser,
  verifyTotpCode,
} from '../lib/mfaHelpers.js';
import speakeasy from 'speakeasy';
import monitor from '../lib/monitor.js';

const getMfaStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user?.id).select('+mfaBackupCodes +mfaPendingSecret');
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    return sendSuccess(res, 200, 'MFA status retrieved', mfaStatusPayload(user));
  } catch (error) {
    console.error('MFA status error:', error);
    return sendError(res, 500, 'Failed to get MFA status');
  }
};

const setupMfa = async (req, res) => {
  try {
    const user = await User.findById(req.user?.id).select('+mfaPendingSecret +mfaSecret +mfaBackupCodes');
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // Re-enrolment is refused while MFA is already on.
    //
    // `setupMfa` used to overwrite `mfaPendingSecret` unconditionally, and
    // `enableMfa` then replaced `mfaSecret` and regenerated the backup codes
    // after validating a code from the *new* pending secret only -- never from
    // the currently-enrolled one, and never against the password. So anyone
    // holding a stolen access token could walk setup -> enable, silently
    // replace the victim's authenticator, take fresh backup codes, and own the
    // second factor outright. No session revocation, no notification.
    //
    // Turning MFA off still requires a valid code from the *current*
    // authenticator (see disableMfa below), so routing re-enrolment through
    // disable-then-enable closes the hole without adding a credential the
    // clients do not currently send to this endpoint.
    if (user.mfaEnabled) {
      return sendError(res, 400, 'Two-factor authentication is already enabled. Disable it with your current authenticator before enrolling a new one.');
    }

    const secret = speakeasy.generateSecret({
      name: `MicroJobs (${user.email})`,
      issuer: 'MicroJobs',
      length: 20,
    });

    user.mfaMethod = MFA_METHOD;
    user.mfaPendingSecret = secret.base32;
    await user.save();
    await monitor.audit({ actor: user._id, action: 'mfa_setup_started', ip: req.ip || null, userAgent: req.get?.('user-agent') || null, status: 'success' });

    return sendSuccess(res, 200, 'MFA setup created', {
      method: MFA_METHOD,
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    return sendError(res, 500, 'Failed to initialize MFA setup');
  }
};

const enableMfa = async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) {
      return sendError(res, 400, 'Verification code is required');
    }

    const user = await User.findById(req.user?.id).select('+mfaPendingSecret +mfaSecret +mfaBackupCodes');
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    // Same reason as setupMfa: a pending secret left over from before MFA was
    // enabled must not become a way to swap out the live authenticator.
    if (user.mfaEnabled) {
      return sendError(res, 400, 'Two-factor authentication is already enabled. Disable it with your current authenticator before enrolling a new one.');
    }
    if (!user.mfaPendingSecret) {
      return sendError(res, 400, 'No MFA setup found. Start setup first.');
    }
    if (!verifyTotpCode(user.mfaPendingSecret, code)) {
      return sendError(res, 400, 'Invalid verification code');
    }

    const backupCodes = generateBackupCodes();
    user.mfaEnabled = true;
    user.mfaMethod = MFA_METHOD;
    user.mfaSecret = user.mfaPendingSecret;
    user.mfaPendingSecret = null;
    user.mfaBackupCodes = await hashBackupCodes(backupCodes);
    await user.save();
    await monitor.audit({ actor: user._id, action: 'mfa_enabled', ip: req.ip || null, userAgent: req.get?.('user-agent') || null, status: 'success' });

    return sendSuccess(res, 200, 'MFA enabled successfully', {
      ...mfaStatusPayload(user),
      backupCodes,
    });
  } catch (error) {
    console.error('MFA enable error:', error);
    return sendError(res, 500, 'Failed to enable MFA');
  }
};

const disableMfa = async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) {
      return sendError(res, 400, 'Verification code is required');
    }

    const user = await User.findById(req.user?.id).select('+mfaPendingSecret +mfaSecret +mfaBackupCodes');
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    if (!user.mfaEnabled) {
      return sendError(res, 400, 'MFA is not enabled');
    }

    const verification = await verifyMfaCodeForUser(user, code, true);
    if (!verification.valid) {
      return sendError(res, 401, 'Invalid MFA code');
    }

    user.mfaEnabled = false;
    user.mfaMethod = null;
    user.mfaSecret = null;
    user.mfaPendingSecret = null;
    user.mfaBackupCodes = [];
    await user.save();
    await monitor.audit({ actor: user._id, action: 'mfa_disabled', ip: req.ip || null, userAgent: req.get?.('user-agent') || null, status: 'success' });

    return sendSuccess(res, 200, 'MFA disabled successfully', mfaStatusPayload(user));
  } catch (error) {
    console.error('MFA disable error:', error);
    return sendError(res, 500, 'Failed to disable MFA');
  }
};

const regenerateBackupCodes = async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) {
      return sendError(res, 400, 'Verification code is required');
    }

    const user = await User.findById(req.user?.id).select('+mfaSecret +mfaBackupCodes +mfaPendingSecret');
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    if (!user.mfaEnabled) {
      return sendError(res, 400, 'MFA is not enabled');
    }

    const verification = await verifyMfaCodeForUser(user, code, true);
    if (!verification.valid) {
      return sendError(res, 401, 'Invalid MFA code');
    }

    const backupCodes = generateBackupCodes();
    user.mfaBackupCodes = await hashBackupCodes(backupCodes);
    await user.save();
    await monitor.audit({ actor: user._id, action: 'mfa_backup_codes_regenerated', ip: req.ip || null, userAgent: req.get?.('user-agent') || null, status: 'success' });

    return sendSuccess(res, 200, 'Backup codes regenerated', {
      ...mfaStatusPayload(user),
      backupCodes,
    });
  } catch (error) {
    console.error('MFA backup regeneration error:', error);
    return sendError(res, 500, 'Failed to regenerate backup codes');
  }
};

export {
  getMfaStatus,
  setupMfa,
  enableMfa,
  disableMfa,
  regenerateBackupCodes,
};
export default {
  getMfaStatus,
  setupMfa,
  enableMfa,
  disableMfa,
  regenerateBackupCodes,
};
