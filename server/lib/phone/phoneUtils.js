export function isValidPhoneNumber(phoneNumber) {
  return /^\+?\d{10,15}$/.test(String(phoneNumber || ''));
}

export function toCountryFormat(localNumber, countryCode = '63') {
  const digitsOnly = String(localNumber || '').replace(/\D/g, '');
  if (!/^0\d{10}$/.test(digitsOnly)) {
    throw new Error(`Invalid local phone number: ${localNumber}`);
  }
  return `${countryCode}${digitsOnly.slice(1)}`;
}
