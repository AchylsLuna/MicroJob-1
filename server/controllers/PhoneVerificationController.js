import { isValidPhoneNumber, toCountryFormat } from '../lib/phone/phoneUtils.js';
import { generateOtp, verifyOtp } from '../lib/phone/otpPhone.js';
import { sendSMS } from '../lib/phone/sms.js';
import crypto from 'node:crypto';
import User from '../models/User.js';
import PhoneVerification from '../models/PhoneVerification.js';

export async function clearPhoneVerificationCode(userId) {
  await PhoneVerification.deleteMany({ user: userId });
}

const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');
const OTP_TTL_MS = 5 * 60 * 1000;

const maskPhoneNumber = (phoneNumber) => {
  const e164 = toCountryFormat(phoneNumber);
  return `${e164.slice(0, -4).replace(/\d/g, '•')}${e164.slice(-4)}`;
};

export async function sendPhoneCode(req, res) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('phoneNumber verification.phoneVerified');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.phoneNumber) return res.status(400).json({ message: 'Please add a phone number in your profile first' });
    if (user.verification?.phoneVerified) return res.status(200).json({ message: 'Phone already verified.', verified: true });
    if (!isValidPhoneNumber(user.phoneNumber)) return res.status(400).json({ message: 'Invalid phone number format' });

    const otp = generateOtp();
    const recipient = toCountryFormat(user.phoneNumber);
    await sendSMS(recipient, `MicroJobs verification code: ${otp}. It expires in 5 minutes.`);
    await PhoneVerification.findOneAndUpdate(
      { user: userId },
      { $set: { pinCodeHash: hashOtp(otp), expiresAt: new Date(Date.now() + OTP_TTL_MS) } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return res.status(200).json({
      message: 'Verification code sent successfully',
      phoneMasked: maskPhoneNumber(user.phoneNumber),
      expiresInSec: OTP_TTL_MS / 1000,
    });
  } catch (error) {
    console.error('Error sending phone code:', error);
    return res.status(500).json({ message: 'Error. Please try again later.' });
  }
}

export async function verifyPhoneCode(req, res) {
  try {
    const userId = req.user.id;
    const otp = String(req.body?.otp || req.body?.code || '').trim();
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({ message: 'Enter the 6-digit verification code.' });

    const phoneVerification = await PhoneVerification.findOne({ user: userId });
    if (!phoneVerification) return res.status(400).json({ message: 'No verification code found for this user.' });
    if (phoneVerification.expiresAt < new Date()) {
      await PhoneVerification.deleteOne({ _id: phoneVerification._id });
      return res.status(400).json({ message: 'Verification code has expired.' });
    }
    if (!verifyOtp(hashOtp(otp), phoneVerification.pinCodeHash)) return res.status(400).json({ message: 'OTP is incorrect.' });

    await User.findByIdAndUpdate(userId, { 'verification.phoneVerified': true });
    await PhoneVerification.deleteOne({ _id: phoneVerification._id });
    return res.status(200).json({ message: 'Phone number verified successfully', verified: true });
  } catch (error) {
    console.error('Error verifying phone code:', error);
    return res.status(500).json({ message: 'Error. Please try again later.' });
  }
}
