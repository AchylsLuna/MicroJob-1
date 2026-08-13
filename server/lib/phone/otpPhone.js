import crypto from 'node:crypto';

export function generateOtp(length = 6) {
  const min = Math.pow(10, Math.max(0, length - 1));
  const max = Math.pow(10, length) - 1;
  const n = crypto.randomInt(min, max + 1);
  return String(n);
}

export function generateNumericOtpString() {
  return generateOtp(6);
}
