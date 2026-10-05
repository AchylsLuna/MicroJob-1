import multer from 'multer';
import PendingIdScan from './PendingIdScan.js';
import { buildUserRateLimitKey, createRateLimiter } from '../lib/rateLimiters.js';

export const ALLOWED_DOCUMENT_TYPES = new Set([
  'PhilSys National ID',
  'Philippine Passport',
  "Driver's License",
  'UMID',
  'SSS Card',
  'PRC ID',
  'PhilHealth ID',
  'TIN Card',
  'Postal ID',
]);

export const PENDING_SCAN_TTL_MS = 10 * 60 * 1000;

// Memory-only upload handling to avoid writing PII to disk.
export const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const scanLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: 'Too many ID scan attempts. Please try again later.',
  keyGenerator: buildUserRateLimitKey('id-scan'),
});

export const textValue = (value) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

const candidateValue = (value) => {
  if (Array.isArray(value)) return candidateValue(value[0]);
  if (value && typeof value === 'object' && 'value' in value) return textValue(value.value);
  return textValue(value);
};

export const findField = (value, names) => {
  if (!value || typeof value !== 'object') return '';
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '');
    if (names.includes(normalizedKey)) {
      const result = candidateValue(child);
      if (result) return result;
    }
    const nested = findField(child, names);
    if (nested) return nested;
  }
  return '';
};

export const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const isTruthy = (value) => {
  const normalized = textValue(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

export const getUserId = (req) => req.user?.id || req.user?.userId;

export const buildVerificationPayload = ({ accepted, decision, profileMatch }) => {
  if (accepted) {
    return {
      update: {
        'verification.identityVerified': true,
        'verification.identityDocument.status': 'complete',
        'verification.identityDocument.reviewedAt': new Date(),
        'verification.identityDocument.rejectionReason': undefined,
      },
      response: { decision: 'accept', verified: true },
    };
  }

  const normal = String(decision).toLowerCase();
  const reason = !profileMatch
    ? 'The document details do not match your profile.'
    : 'Document requires review or was rejected. Please try again.';

  return {
    update: {
      'verification.identityVerified': false,
      'verification.identityDocument.status': normal === 'review' && profileMatch ? 'in-review' : 'rejected',
      'verification.identityDocument.reviewedAt': new Date(),
      'verification.identityDocument.rejectionReason': reason,
    },
    response: { decision: normal, verified: false, profileMatch, message: reason },
  };
};

export const savePendingScan = (userId, pending) => PendingIdScan.findOneAndUpdate(
  { user: userId },
  { $set: { ...pending, expiresAt: new Date(Date.now() + PENDING_SCAN_TTL_MS) } },
  { upsert: true, new: true, setDefaultsOnInsert: true },
).lean();

export const getPendingScan = (userId) => PendingIdScan.findOne({ user: userId }).lean();

export const deletePendingScan = (userId) => PendingIdScan.deleteOne({ user: userId });
