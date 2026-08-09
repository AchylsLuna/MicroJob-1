export function isValidPhoneNumber(phoneNumber) {
    const phoneRegex = /^\+?\d{10,15}$/;
    return phoneRegex.test(phoneNumber);
}

export function toCountryFormat(localNumber, countryCode = '63') {
  const digitsOnly = localNumber.replace(/\D/g, ''); // strip spaces/dashes/etc

  if (!/^0\d{10}$/.test(digitsOnly)) {
    throw new Error(`Invalid local phone number: ${localNumber}`);
  }

  const withoutLeadingZero = digitsOnly.slice(1); // drop the '0', leaves 10 digits
  return `${countryCode}${withoutLeadingZero}`;
}