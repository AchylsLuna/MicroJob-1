import crypto from 'node:crypto';

export function generateOtp(length = 6) {
  const upperBound = 10 ** length;
  return String(crypto.randomInt(0, upperBound)).padStart(length, '0');
}

export function verifyOtp(otp, expectedOtp) {
  return String(otp) === String(expectedOtp);
}
