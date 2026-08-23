import User from '../models/User.js';
import IdAnalyzer from 'idanalyzer2';
import { hasValidVerificationFileSignature } from '../middleware/uploadConfig.js';
import {
  ALLOWED_DOCUMENT_TYPES,
  buildVerificationPayload,
  deletePendingScan,
  findField,
  getPendingScan,
  getUserId,
  isTruthy,
  normalize,
  savePendingScan,
  textValue,
} from '../models/IdAnalyzerModel.js';

const { Profile, Scanner } = IdAnalyzer;

const runScan = async ({ req, selectedDocumentType }) => {
  if (!req.file || !req.file.buffer) {
    return { status: 400, body: { message: 'No document uploaded.' } };
  }

  if (!hasValidVerificationFileSignature(req.file)) {
    return { status: 400, body: { message: 'Uploaded file appears to be invalid or unsupported.' } };
  }

  const profileId = String(process.env.KYC_PROFILE_ID || '').trim();
  if (!profileId) return { status: 400, body: { message: 'profileId is required.' } };

  if (!process.env.IDANALYZER_KEY) {
    console.error('ID Analyzer API key not configured.');
    return { status: 500, body: { message: 'KYC provider misconfigured.' } };
  }

  const profile = new Profile(profileId);
  const scanner = new Scanner();
  scanner.setProfile(profile);
  scanner.throwApiException(true);

  const base64 = Buffer.from(req.file.buffer).toString('base64');
  const resp = await scanner.scan(base64);

  const decision = resp?.decision || resp?.Decision || resp?.result?.decision || resp?.status || null;

  if (!decision) {
    console.error('ID Analyzer returned no decision.');
    return { status: 502, body: { message: 'Unexpected response from KYC provider.' } };
  }

  const userId = getUserId(req);
  const user = await User.findById(userId).select('firstName lastName');
  if (!user) return { status: 404, body: { message: 'User not found.' } };

  const fullName = findField(resp, ['fullname', 'name']).trim();
  const extracted = {
    firstName: findField(resp, ['firstname', 'givenname', 'namefirst']),
    lastName: findField(resp, ['lastname', 'surname', 'namelast']),
    documentNumber: findField(resp, ['documentnumber', 'idnumber', 'idno', 'license']),
    dateOfBirth: findField(resp, ['dateofbirth', 'birthdate', 'dob']),
    address: [
      findField(resp, ['address1']),
      findField(resp, ['address2']),
      findField(resp, ['address', 'residentialaddress']),
    ].filter(Boolean).join(', '),
  };

  if (!extracted.lastName) {
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    if (nameParts.length > 1) {
      extracted.firstName = extracted.firstName || nameParts.slice(0, -1).join(' ');
      extracted.lastName = nameParts[nameParts.length - 1];
    }
  }

  const profileMatch = Boolean(
    extracted.firstName &&
      extracted.lastName &&
      normalize(extracted.firstName) === normalize(user.firstName) &&
      normalize(extracted.lastName) === normalize(user.lastName)
  );

  const normalDecision = String(decision).toLowerCase();
  const accepted = normalDecision === 'accept' && profileMatch;

  return {
    status: 200,
    body: {
      userId,
      selectedDocumentType,
      extracted,
      decision: normalDecision,
      profileMatch,
      accepted,
    },
  };
};

export const verifyIdDocument = async (req, res) => {
  try {
    const selectedDocumentType = textValue(req.body?.documentType).trim();
    if (!ALLOWED_DOCUMENT_TYPES.has(selectedDocumentType)) {
      return res.status(400).json({
        message: `Document type must be one of: ${Array.from(ALLOWED_DOCUMENT_TYPES).join(', ')}`,
      });
    }

    const scan = await runScan({ req, selectedDocumentType });
    if (scan.status !== 200) {
      return res.status(scan.status).json(scan.body);
    }

    const finalize = isTruthy(req.body?.finalize);
    const { userId, extracted, decision, profileMatch, accepted } = scan.body;

    if (finalize) {
      const payload = buildVerificationPayload({ accepted, decision, profileMatch });
      await User.findByIdAndUpdate(userId, payload.update);
      return res.status(200).json({ ...payload.response, extracted });
    }

    savePendingScan(userId, {
      decision,
      profileMatch,
      accepted,
      selectedDocumentType,
      extracted,
    });

    return res.status(200).json({
      decision,
      verified: false,
      profileMatch,
      extracted,
      pending: true,
    });
  } catch (error) {
    if (error && (error.code !== undefined || String(error.name).toLowerCase().includes('apierror') || error?.statusCode)) {
      const code = String(error.code || error?.statusCode || '');
      const msg = error.msg || error?.message || 'KYC provider error.';

      console.error('KYC provider error:', code, msg);

      if (code === '401' || code.toLowerCase() === 'unauthorized') {
        return res.status(502).json({ message: 'KYC provider authentication failed.' });
      }
      if (code === '429') {
        return res.status(429).json({ message: 'Too many requests. Please try again later.' });
      }
      if (code === '400') {
        return res.status(400).json({ message: 'Invalid document provided.' });
      }

      return res.status(502).json({ message: 'KYC provider error.' });
    }

    console.error('KYC scan error:', error?.message || error);
    return res.status(500).json({ message: 'Failed to perform KYC scan.' });
  }
};

export const confirmIdVerification = async (req, res) => {
  try {
    const userId = String(getUserId(req) || '');
    if (!userId) return res.status(401).json({ message: 'Unauthorized.' });

    const pending = getPendingScan(userId);
    if (!pending) {
      return res.status(400).json({ message: 'No pending scan found. Please scan your document again.' });
    }
    if (pending.expiresAt <= Date.now()) {
      deletePendingScan(userId);
      return res.status(400).json({ message: 'Your pending scan expired. Please scan your document again.' });
    }

    const payload = buildVerificationPayload(pending);
    await User.findByIdAndUpdate(userId, payload.update);
    deletePendingScan(userId);
    return res.status(200).json({ ...payload.response, extracted: pending.extracted });
  } catch (error) {
    console.error('KYC confirm error:', error?.message || error);
    return res.status(500).json({ message: 'Failed to finalize KYC verification.' });
  }
};

export const discardIdVerification = async (req, res) => {
  const userId = String(getUserId(req) || '');
  if (!userId) return res.status(401).json({ message: 'Unauthorized.' });
  deletePendingScan(userId);
  return res.status(200).json({ cleared: true });
};

export default {
  verifyIdDocument,
  confirmIdVerification,
  discardIdVerification,
};
