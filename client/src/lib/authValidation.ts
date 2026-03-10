export const PHONE_DIGITS = 11;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_REGEX = /^[A-Za-z][A-Za-z\s'.-]*$/;
const PH_PHONE_REGEX = /^09\d{9}$/;

export const EMAIL_VALIDATION_MESSAGE =
  "Please enter a valid email address (example: email@gmail.com).";
export const PHONE_VALIDATION_MESSAGE = "Phone number must be a valid Philippine mobile number (09XXXXXXXXX).";
export const FULL_NAME_VALIDATION_MESSAGE =
  "Full name must contain letters only (spaces, apostrophes, hyphens, and periods are allowed).";

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(normalizeEmail(value));
}

export function normalizePhone(value: string): string {
  const digitsOnly = value.replace(/\D/g, "");
  if (digitsOnly.startsWith("63")) {
    return `0${digitsOnly.slice(2)}`.slice(0, PHONE_DIGITS);
  }
  return digitsOnly.slice(0, PHONE_DIGITS);
}

export function isValidPhone(value: string): boolean {
  return PH_PHONE_REGEX.test(value);
}

export function normalizeFullName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function sanitizeFullNameInput(value: string): string {
  return value.replace(/[^A-Za-z\s'.-]/g, "").replace(/\s{2,}/g, " ");
}

export function isValidFullName(value: string): boolean {
  return NAME_REGEX.test(normalizeFullName(value));
}
