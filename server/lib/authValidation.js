export const PHONE_DIGITS = 11;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_REGEX = /^[\p{L}][\p{L}\s'.-]*$/u;

export const EMAIL_VALIDATION_MESSAGE =
  "Please enter a valid email address (example: email@gmail.com).";
export const PHONE_VALIDATION_MESSAGE = `Phone number must be exactly ${PHONE_DIGITS} digits.`;
export const NAME_VALIDATION_MESSAGE =
  "Name must contain letters only (spaces, apostrophes, hyphens, and periods are allowed).";

export function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

export function normalizePhone(value = "") {
  return String(value).replace(/\D/g, "");
}

export function isValidEmail(value = "") {
  return EMAIL_REGEX.test(normalizeEmail(value));
}

export function isValidPhone(value = "") {
  return new RegExp(`^\\d{${PHONE_DIGITS}}$`).test(String(value));
}

export function normalizeName(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function isValidName(value = "") {
  return NAME_REGEX.test(normalizeName(value));
}
