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

    const secret = speakeasy.generateSecret({
      name: `MicroJobs (${user.email})`,
      issuer: 'MicroJobs',
      length: 20,
    });

    user.mfaMethod = MFA_METHOD;
    user.mfaPendingSecret = secret.base32;
    await user.save();

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
