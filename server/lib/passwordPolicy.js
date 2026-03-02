export const MIN_PASSWORD_LENGTH = 8;

const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /\d/;
const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/;

export const PASSWORD_POLICY_MESSAGE =
  `Password must be at least ${MIN_PASSWORD_LENGTH} characters and include uppercase, lowercase, number, and special character.`;

export function getPasswordChecks(password = "") {
  return {
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    uppercase: UPPERCASE_REGEX.test(password),
    lowercase: LOWERCASE_REGEX.test(password),
    number: NUMBER_REGEX.test(password),
    special: SPECIAL_CHAR_REGEX.test(password),
  };
}

export function isStrongPassword(password = "") {
  const checks = getPasswordChecks(password);
  return Object.values(checks).every(Boolean);
}
