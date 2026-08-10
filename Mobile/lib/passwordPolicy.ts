export const MIN_PASSWORD_LENGTH = 8;

export type PasswordChecks = {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
};

export const PASSWORD_POLICY_MESSAGE = `Password must be at least ${MIN_PASSWORD_LENGTH} characters and include uppercase, lowercase, number, and special character.`;

export const PASSWORD_RULES: Array<{ key: keyof PasswordChecks; label: string }> = [
  { key: 'minLength', label: `At least ${MIN_PASSWORD_LENGTH} characters` },
  { key: 'uppercase', label: 'One uppercase letter (A-Z)' },
  { key: 'lowercase', label: 'One lowercase letter (a-z)' },
  { key: 'number', label: 'One number (0-9)' },
  { key: 'special', label: 'One special character' },
];

export function getPasswordChecks(password = ''): PasswordChecks {
  return {
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export const isStrongPassword = (password = '') => Object.values(getPasswordChecks(password)).every(Boolean);
