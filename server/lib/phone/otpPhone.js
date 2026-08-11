export function generateOtp(length = 6) {
  const min = Math.pow(10, Math.max(0, length - 1));
  const max = Math.pow(10, length) - 1;
  const n = Math.floor(Math.random() * (max - min + 1)) + min;
  return String(n);
}

export function generateNumericOtpString() {
  return generateOtp(6);
}
