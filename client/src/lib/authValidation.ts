import type { TFunction } from "i18next";

export const PHONE_DIGITS = 11;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_REGEX = /^[\p{L}][\p{L}\s'.-]*$/u;
const PH_PHONE_REGEX = /^09\d{9}$/;

// Translated equivalents. Callers pass the `t` from
// `useTranslation("auth")` so these resolve "validation.*" keys in
// client/src/locales/{en,tl}/auth.json.
export function getEmailValidationMessage(t: TFunction): string {
  return t("validation.email");
}

export function getPhoneValidationMessage(t: TFunction): string {
  return t("validation.phone");
}

export function getFullNameValidationMessage(t: TFunction): string {
  return t("validation.fullName");
}

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
