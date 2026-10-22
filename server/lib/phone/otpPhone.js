import crypto from 'node:crypto';

export function generateOtp(length = 6) {
  const upperBound = 10 ** length;
  return String(crypto.randomInt(0, upperBound)).padStart(length, '0');
}

export function verifyOtp(otp, expectedOtp) {
  const actual = Buffer.from(String(otp));
  const expected = Buffer.from(String(expectedOtp));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
