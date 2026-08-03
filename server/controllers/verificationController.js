import User from '../models/User.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import {
  PhoneOtpError,
  sendPhoneVerificationOtp,
  verifyPhoneVerificationOtp,
} from '../lib/phoneOtp.js';
import {
  removeUploadFile,
  hasValidVerificationFileSignature,
} from '../middleware/uploadConfig.js';

export const getVerificationStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('verification email phoneNumber status');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const steps = [
      {
        id: 'email',
        title: 'Email address',
        description: 'Confirm the email you use to sign in and receive alerts.',
        status: user.verification?.emailVerified ? 'complete' : 'pending',
      },
      {
        id: 'phone',
        title: 'Phone number',
        description: 'Add a verified phone for account recovery and security checks.',
        status: user.verification?.phoneVerified ? 'complete' : user.phoneNumber ? 'in-review' : 'pending',
      },
      {
        id: 'identity',
        title: 'Government ID',
        description: user.verification?.identityDocument?.status === 'rejected'
          ? `Rejected: ${user.verification?.identityDocument?.rejectionReason || 'Please upload a clearer valid ID.'}`
          : 'Upload a valid ID to prove your identity.',
        status: user.verification?.identityDocument?.status || 'pending',
      },
      {
        id: 'address',
        title: 'Proof of address',
        description: user.verification?.addressDocument?.status === 'rejected'
          ? `Rejected: ${user.verification?.addressDocument?.rejectionReason || 'Please upload a valid recent document.'}`
          : 'Provide a recent utility bill or bank statement.',
        status: user.verification?.addressDocument?.status || 'pending',
      },
    ];

    const completedSteps = steps.filter((step) => step.status === 'complete').length;
    const completionPercent = Math.round((completedSteps / steps.length) * 100);

    return res.status(200).json({
      steps,
      completedSteps,
      completionPercent,
    });
  } catch (err) {
    console.error('Get verification status error', err);
    return res.status(500).json({ message: 'Failed to get verification status' });
  }
};

export const sendPhoneVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('phoneNumber verification.phoneVerified');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.phoneNumber) {
      return res.status(400).json({ message: 'Please add a phone number in your profile first' });
    }

    if (user.verification?.phoneVerified) {
      return res.status(200).json({ message: 'Phone already verified.', verified: true });
    }

    const otpResult = await sendPhoneVerificationOtp({
      userId: String(user._id),
      phoneNumber: user.phoneNumber,
    });

    return res.status(200).json(otpResult);
  } catch (err) {
    if (err instanceof PhoneOtpError) {
      const retryAfterSec = err?.metadata?.retryAfterSec;
      if (retryAfterSec) {
        res.setHeader('Retry-After', String(retryAfterSec));
      }
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
    console.error('Phone verification error', err);
    return res.status(500).json({ message: 'Failed to start phone verification' });
  }
};

export const confirmPhoneVerification = async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) {
      return res.status(400).json({ message: 'Verification code is required.' });
    }

    const user = await User.findById(req.user.id).select('phoneNumber verification.phoneVerified');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.phoneNumber) {
      return res.status(400).json({ message: 'Please add a phone number in your profile first' });
    }

    if (user.verification?.phoneVerified) {
      return res.status(200).json({ message: 'Phone already verified.', verified: true });
    }

    verifyPhoneVerificationOtp({
      userId: String(user._id),
      phoneNumber: user.phoneNumber,
      code,
    });

    user.verification = user.verification || {};
    user.verification.phoneVerified = true;
    await user.save();

    return res.status(200).json({ message: 'Phone verification completed', verified: true });
  } catch (err) {
    if (err instanceof PhoneOtpError) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
    console.error('Phone verification confirm error', err);
    return res.status(500).json({ message: 'Failed to verify phone' });
  }
};

export const uploadIdentityDocument = async (req, res) => {
  let persisted = false;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No document file provided' });
    }
    if (!hasValidVerificationFileSignature(req.file)) {
      removeUploadFile(req.file.filename);
      return res.status(400).json({ message: 'The uploaded file content does not match its document type.' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      removeUploadFile(req.file.filename);
      return res.status(404).json({ message: 'User not found' });
    }

    const documentUrl = `/uploads/${req.file.filename}`;
    const previousDocumentUrl = user.verification?.identityDocument?.documentUrl;
    user.verification = user.verification || {};
    user.verification.identityVerified = false;
    user.verification.identityDocument = {
      status: 'in-review',
      documentUrl,
      uploadedAt: new Date(),
    };
    await user.save();
    persisted = true;
    if (previousDocumentUrl && previousDocumentUrl !== documentUrl) removeUploadFile(previousDocumentUrl);

    return res.status(200).json({
      message: 'Identity document uploaded successfully',
      documentUrl,
      status: 'in-review',
    });
  } catch (err) {
    if (!persisted && req.file?.filename) removeUploadFile(req.file.filename);
    console.error('Identity document upload error', err);
    return res.status(500).json({ message: 'Failed to upload identity document' });
  }
};

export const uploadAddressDocument = async (req, res) => {
  let persisted = false;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No document file provided' });
    }
    if (!hasValidVerificationFileSignature(req.file)) {
      removeUploadFile(req.file.filename);
      return res.status(400).json({ message: 'The uploaded file content does not match its document type.' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      removeUploadFile(req.file.filename);
      return res.status(404).json({ message: 'User not found' });
    }

    const documentUrl = `/uploads/${req.file.filename}`;
    const previousDocumentUrl = user.verification?.addressDocument?.documentUrl;
    user.verification = user.verification || {};
    user.verification.addressVerified = false;
    user.verification.addressDocument = {
      status: 'in-review',
      documentUrl,
      uploadedAt: new Date(),
    };
    await user.save();
    persisted = true;
    if (previousDocumentUrl && previousDocumentUrl !== documentUrl) removeUploadFile(previousDocumentUrl);

    return res.status(200).json({
      message: 'Address document uploaded successfully',
      documentUrl,
      status: 'in-review',
    });
  } catch (err) {
    if (!persisted && req.file?.filename) removeUploadFile(req.file.filename);
    console.error('Address document upload error', err);
    return res.status(500).json({ message: 'Failed to upload address document' });
  }
};

export default {
  getVerificationStatus,
  sendPhoneVerification,
  confirmPhoneVerification,
  uploadIdentityDocument,
  uploadAddressDocument,
};
