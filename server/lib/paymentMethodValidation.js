const ALLOWED_BRANDS = new Set(['Visa', 'Mastercard', 'Card']);

export function isExpiredPaymentMethod(expiryMonth, expiryYear, now = new Date()) {
  const month = Number(expiryMonth);
  const year = Number(expiryYear);
  return year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
}

export function normalizePaymentMethodMetadata(payload = {}, now = new Date()) {
  if (
    payload.cardNumber !== undefined ||
    payload.number !== undefined ||
    payload.cvv !== undefined ||
    payload.cvc !== undefined
  ) {
    return {
      error: 'Full card numbers and security codes must not be sent to this server.',
    };
  }

  const cardholderName = String(payload.cardholderName || '').replace(/\s+/g, ' ').trim();
  const brand = ALLOWED_BRANDS.has(payload.brand) ? payload.brand : 'Card';
  const last4 = String(payload.last4 || '').trim();
  const expiryMonth = Number(payload.expiryMonth);
  const expiryYear = Number(payload.expiryYear);

  if (cardholderName.length < 2 || cardholderName.length > 80) {
    return { error: 'Enter a valid name on the card.' };
  }
  if (!/^\d{4}$/.test(last4)) {
    return { error: 'Enter valid card details.' };
  }
  if (!Number.isInteger(expiryMonth) || expiryMonth < 1 || expiryMonth > 12) {
    return { error: 'Enter a valid expiry month.' };
  }
  if (!Number.isInteger(expiryYear) || expiryYear < now.getFullYear() || expiryYear > now.getFullYear() + 25) {
    return { error: 'Enter a valid expiry year.' };
  }
  if (isExpiredPaymentMethod(expiryMonth, expiryYear, now)) {
    return { error: 'This card has expired.' };
  }

  return {
    value: {
      cardholderName,
      brand,
      last4,
      expiryMonth,
      expiryYear,
    },
  };
}
