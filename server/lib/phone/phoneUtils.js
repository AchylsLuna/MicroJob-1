export function normalizePhoneNumber(value = '', defaultCountry = process.env.PHONE_OTP_DEFAULT_COUNTRY_CODE || '+63') {
  let s = String(value || '').trim();
  if (!s) return '';

  // Remove common separators and whitespace
  s = s.replace(/[\s()-\.]/g, '');

  // If already in E.164 (starts with + and digits), return as-is
  if (/^\+\d+$/.test(s)) return s;

  // If starts with country code without + (e.g. 63...), add +
  if (/^\d+$/.test(s) && defaultCountry && s.startsWith(defaultCountry.replace('+', ''))) {
    return `+${s}`;
  }

  // Local Philippine-style numbers often start with 0 and are 11 digits (09XXXXXXXXX)
  if (/^0\d{9,}$/.test(s) && defaultCountry) {
    return `${defaultCountry}${s.slice(1)}`.startsWith('+') ? `${defaultCountry}${s.slice(1)}` : `+${String(defaultCountry).replace('+','')}${s.slice(1)}`;
  }

  // If it's digits only and looks like a local national number, prefix default country
  if (/^\d+$/.test(s) && defaultCountry) {
    return `+${String(defaultCountry).replace('+','')}${s}`;
  }

  // Fallback: return trimmed input
  return s;
}

export function isValidPhoneNumber(value = '') {
  const normalized = normalizePhoneNumber(value);
  // E.164-like: leading + then 8-15 digits
  return /^\+\d{8,15}$/.test(normalized);
}

export function toE164(value = '', defaultCountryCode = process.env.PHONE_OTP_DEFAULT_COUNTRY_CODE || '+63') {
  let raw = String(value || '').trim();
  if (!raw) return '';

  // Remove non-digits except leading +
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/[^0-9]/g, '');

  // If already has leading + and digits, reconstruct
  if (hasPlus && digits.length) return `+${digits}`;

  // If starts with the country code digits (e.g., 63...), add +
  const ccDigits = String(defaultCountryCode || '+63').replace(/[^0-9]/g, '');
  if (digits.startsWith(ccDigits)) return `+${digits}`;

  // Local format starting with 0 (e.g., 09171234567) -> replace leading 0 with country code
  if (digits.length >= 8 && digits.startsWith('0')) {
    return `+${ccDigits}${digits.slice(1)}`;
  }

  // Fallback: prefix with country code
  return `+${ccDigits}${digits}`;
}

