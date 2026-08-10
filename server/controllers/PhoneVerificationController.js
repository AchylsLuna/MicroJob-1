import { isValidPhoneNumber } from '../lib/phone/phoneUtils.js';
import { generateOtp} from '../lib/phone/otpPhone.js';
import { sendSMS } from '../lib/phone/sms.js';
import User from '../models/User.js';
import PhoneVerification from '../models/PhoneVerification.js';

export async function sendPhoneCode(req, res) {
    try {
        const userId = req.user.id;
        const phoneNumber = await getPhoneNumber(userId);
        if (!isValidPhoneNumber(phoneNumber)) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }
        const formatted = phoneNumber;
        const otp = generateOtp();
        await sendSMS(formatted, `MicroJobs verification code: ${otp}`);

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

        await PhoneVerification.deleteMany({ user: userId });

        await PhoneVerification.create({
            user: userId,
            pinCode: otp,
            expiresAt,
        });

        return res.status(200).json({ message: 'Verification code sent successfully' });
    } catch (error) {
    console.error('Error sending phone code:', error);
    return res.status(500).json({ error: 'Error. Please try again later.' });
    }
}

export async function resendPhoneCode(req, res) {
    try {
        const userId = req.user.id;
        const phoneNumber = await getPhoneNumber(userId);
        if (!isValidPhoneNumber(phoneNumber)) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }
        const formatted = phoneNumber;
        const otp = generateOtp();
        await sendSMS(formatted, `MicroJobs verification code: ${otp}`);

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

        await PhoneVerification.deleteMany({ user: userId });

        await PhoneVerification.create({
            user: userId,
            pinCode: otp,
            expiresAt,
        });

        return res.status(200).json({ message: 'Verification code resent successfully' });
    } catch (error) {
        console.error('Error resending phone code:', error);
        return res.status(500).json({ error: 'Error. Please try again later.' });
    }
}

export async function verifyPhoneCode(req, res) {
    try {
        const userId = req.user.id;
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({ error: 'OTP is required.' });
        }

        const phoneVerification = await PhoneVerification.findOne({ user: userId }).sort({ expiresAt: -1 });

        if (!phoneVerification) {
            return res.status(400).json({ error: 'No verification code found for this user.' });
        }

        if (phoneVerification.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Verification code has expired.' });
        }

        if (String(otp) !== String(phoneVerification.pinCode)) {
            return res.status(400).json({ error: 'OTP is incorrect.' });
        }
        await User.findByIdAndUpdate(userId, { 'verification.phoneVerified': true });
        await PhoneVerification.deleteOne({ _id: phoneVerification._id });

        return res.status(200).json({ message: 'Phone number verified successfully' });
    } catch (error) {
        console.error('Error verifying phone code:', error);
        return res.status(500).json({ error: 'Error. Please try again later.' });
    }
}

async function getPhoneNumber(userId) {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    if(!user.phoneNumber) {
        throw new Error('Please set a phone number in your profile first');
    }
    return user.phoneNumber;
}