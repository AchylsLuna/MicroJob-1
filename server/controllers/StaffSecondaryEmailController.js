import User from '../models/User.js';
import OtpChallenge from '../models/OtpChallenge.js';
import { isValidEmail, normalizeEmail } from '../lib/authValidation.js';
import { getEmailTransporter, getMailFrom } from '../lib/emailTransporter.js';
import { issueOtpChallenge, verifyOtpChallenge, rememberTestOtpCode } from '../lib/otpChallenges.js';
import { isStaffAccount, hasVerifiedSecondaryEmail } from '../lib/staffSecurity.js';
import monitor from '../lib/monitor.js';

const purpose = 'secondary-email-verification';
const subjectFor = (user) => `staff-secondary-email:${user._id}`;
const statusFor = (user) => ({ email: user.secondaryEmail || '', verified: hasVerifiedSecondaryEmail(user) });
const loadStaff = async (req, res) => {
  const user = await User.findById(req.user?.id || req.user?.userId)
    .select('+passwordHashed +secondaryEmail +secondaryEmailVerifiedAt');
  if (!user || !isStaffAccount(user) || user.status !== 'active') {
    res.status(403).json({ message: 'An active staff account is required.' });
    return null;
  }
  return user;
};

export async function getSecondaryEmail(req, res) {
  try {
    const user = await loadStaff(req, res);
    if (user) return res.json(statusFor(user));
  } catch {
    return res.status(500).json({ message: 'Failed to load secondary email.' });
  }
}

export async function requestSecondaryEmailOtp(req, res) {
  let challenge;
  try {
    const user = await loadStaff(req, res);
    if (!user) return;
    const email = normalizeEmail(req.body?.email);
    if (email.length > 254 || !isValidEmail(email)) return res.status(400).json({ message: 'Enter a valid secondary email address.' });
    if (email === normalizeEmail(user.email)) return res.status(400).json({ message: 'Secondary email must differ from your sign-in email.' });
    if (!req.body?.currentPassword || !await user.validatePassword(req.body.currentPassword)) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
    const transporter = getEmailTransporter();
    if (!transporter && process.env.NODE_ENV !== 'test') {
      return res.status(503).json({ message: 'Email service is not configured.' });
    }
    const issued = await issueOtpChallenge({ purpose, subject: subjectFor(user), user: user._id, carryAttempts: true,
      metadata: { email, previousEmail: user.secondaryEmail || null, previousVerifiedAt: user.secondaryEmailVerifiedAt?.toISOString() || null } });
    challenge = issued.challenge;
    if (transporter) {
      const from = getMailFrom();
      await transporter.sendMail({ from: from.includes('<') ? from : `MicroJobs <${from}>`, to: email,
        subject: 'MicroJobs secondary email verification',
        text: `Your MicroJobs secondary email verification code is ${issued.code}. It expires in 5 minutes. If you did not request this, ignore this email.` });
    }
    rememberTestOtpCode(purpose, subjectFor(user), issued.code);
    return res.json({ message: 'Verification OTP sent to your secondary email.' });
  } catch {
    if (challenge) await OtpChallenge.updateOne({ _id: challenge._id }, { $set: { active: false, invalidatedAt: new Date() } });
    return res.status(500).json({ message: 'Failed to send secondary email OTP. Try again.' });
  }
}

export async function confirmSecondaryEmailOtp(req, res) {
  try {
    const user = await loadStaff(req, res);
    if (!user) return;
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ message: 'Enter the six-digit OTP.' });
    const verification = await verifyOtpChallenge({ purpose, subject: subjectFor(user), code, consume: true });
    if (!verification.ok) return res.status(verification.reason === 'attempts' ? 429 : 400)
      .json({ message: 'Verification code is invalid or expired. Request a new code.' });
    const { challenge } = verification;
    if (String(challenge.user) !== String(user._id) || challenge.metadata.email !== email || email === normalizeEmail(user.email)) {
      return res.status(400).json({ message: 'Verification code does not match this email.' });
    }
    // An older enrollment must not overwrite a newer verified address.
    const updated = await User.findOneAndUpdate({ _id: user._id, role: user.role, status: 'active', email: user.email,
      secondaryEmail: challenge.metadata.previousEmail,
      secondaryEmailVerifiedAt: challenge.metadata.previousVerifiedAt },
    { $set: { secondaryEmail: email, secondaryEmailVerifiedAt: new Date() } }, { returnDocument: 'after' })
      .select('+secondaryEmail +secondaryEmailVerifiedAt');
    if (!updated) return res.status(409).json({ message: 'Account security details changed. Request a new code.' });
    await OtpChallenge.updateMany({ user: user._id, purpose: { $in: ['password-change', 'login'] }, active: true },
      { $set: { active: false, invalidatedAt: new Date() } });
    await monitor.audit({ actor: user._id, action: 'staff_secondary_email_verified', status: 'success', ip: req.ip || null });
    return res.json({ ...statusFor(updated), message: 'Secondary email verified.' });
  } catch {
    return res.status(500).json({ message: 'Failed to verify secondary email.' });
  }
}
