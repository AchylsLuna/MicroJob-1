export const PHONE_DIGITS = 11;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_REGEX = /^[\p{L}][\p{L}\s'.-]*$/u;
const PH_PHONE_REGEX = /^09\d{9}$/;

export const EMAIL_VALIDATION_MESSAGE = 'Please enter a valid email address (example: email@gmail.com).';
export const PHONE_VALIDATION_MESSAGE = 'Phone number must be a valid Philippine mobile number (09XXXXXXXXX).';
export const NAME_VALIDATION_MESSAGE = 'Full name must contain letters only (spaces, apostrophes, hyphens, and periods are allowed).';

export const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
export const isValidEmail = (value = '') => EMAIL_REGEX.test(normalizeEmail(value));

export function normalizePhone(value = '') {
  const digitsOnly = String(value).replace(/\D/g, '');
  if (digitsOnly.startsWith('63')) {
    return `0${digitsOnly.slice(2)}`.slice(0, PHONE_DIGITS);
  }
  return digitsOnly.slice(0, PHONE_DIGITS);
}

export const isValidPhone = (value = '') => PH_PHONE_REGEX.test(String(value));
export const normalizeName = (value = '') => String(value).replace(/\s+/g, ' ').trim();
export const isValidName = (value = '') => NAME_REGEX.test(normalizeName(value));

export function parseFullName(value = '') {
  const normalized = normalizeName(value);
  if (!isValidName(normalized)) return null;
  const [firstName, ...rest] = normalized.split(' ');
  const lastName = rest.join(' ');
  return firstName && lastName ? { normalized, firstName, lastName } : null;
}
