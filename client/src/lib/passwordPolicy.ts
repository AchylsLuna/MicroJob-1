export const MIN_PASSWORD_LENGTH = 8;

const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /\d/;
const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/;

export const STRONG_PASSWORD_ERROR = `Password must be at least ${MIN_PASSWORD_LENGTH} characters and include uppercase, lowercase, number, and special character.`;

export type PasswordChecks = {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
};

export type PasswordStrength = {
  checks: PasswordChecks;
  score: number;
  percent: number;
  label: "Weak" | "Fair" | "Good" | "Strong" | "Very Strong";
  isStrong: boolean;
};

export const PASSWORD_RULES: Array<{ key: keyof PasswordChecks; label: string }> = [
  { key: "minLength", label: `At least ${MIN_PASSWORD_LENGTH} characters` },
  { key: "uppercase", label: "One uppercase letter (A-Z)" },
  { key: "lowercase", label: "One lowercase letter (a-z)" },
  { key: "number", label: "One number (0-9)" },
  { key: "special", label: "One special character" },
];

export function getPasswordStrength(password: string): PasswordStrength {
  const checks: PasswordChecks = {
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    uppercase: UPPERCASE_REGEX.test(password),
    lowercase: LOWERCASE_REGEX.test(password),
    number: NUMBER_REGEX.test(password),
    special: SPECIAL_CHAR_REGEX.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;
  const percent = Math.round((score / PASSWORD_RULES.length) * 100);

  let label: PasswordStrength["label"] = "Weak";
  if (score === 2) {
    label = "Fair";
  } else if (score === 3) {
    label = "Good";
  } else if (score === 4) {
    label = "Strong";
  } else if (score === PASSWORD_RULES.length) {
    label = "Very Strong";
  }

  return {
    checks,
    score,
    percent,
    label,
    isStrong: score === PASSWORD_RULES.length,
  };
}
