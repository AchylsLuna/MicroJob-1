export function isValidPhoneNumber(phoneNumber) {
  const digitsOnly = String(phoneNumber || '').replace(/\D/g, '');
  return /^(?:09\d{9}|639\d{9})$/.test(digitsOnly);
}

export function toCountryFormat(localNumber, countryCode = '63') {
  const digitsOnly = String(localNumber || '').replace(/\D/g, '');
  const normalizedCountryCode = String(countryCode || '').replace(/\D/g, '');
  if (!normalizedCountryCode) {
    throw new Error('A country calling code is required');
  }

  if (digitsOnly.startsWith(normalizedCountryCode)) {
    const nationalNumber = digitsOnly.slice(normalizedCountryCode.length);
    if (!/^9\d{9}$/.test(nationalNumber)) {
      throw new Error(`Invalid phone number: ${localNumber}`);
    }
    return `+${normalizedCountryCode}${nationalNumber}`;
  }

  if (!/^09\d{9}$/.test(digitsOnly)) {
    throw new Error(`Invalid local phone number: ${localNumber}`);
  }
  return `+${normalizedCountryCode}${digitsOnly.slice(1)}`;
}
