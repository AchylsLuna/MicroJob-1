const TEXTBEE_SEND_SMS_URL = 'https://api.textbee.dev/api/v1/gateway/send-sms';

const getErrorMessage = (payload) => {
  const result = payload?.data ?? payload;
  return result?.message || payload?.message || payload?.error?.message || 'Textbee rejected the SMS request';
};

export class SmsProviderError extends Error {
  constructor(message, { status = 502, code = 'provider_error' } = {}) {
    super(message);
    this.name = 'SmsProviderError';
    this.status = status;
    this.code = code;
  }
}

export async function sendSMS(phoneNumber, message) {
  const apiKey = process.env.TEXTBEE_API_KEY?.trim();
  const deviceId = process.env.TEXTBEE_DEVICE_ID?.trim();
  if (!apiKey) {
    throw new SmsProviderError('SMS provider is not configured', {
      status: 503,
      code: 'provider_not_configured',
    });
  }

  const payload = {
    recipients: [phoneNumber],
    message,
    ...(deviceId ? { deviceId } : {}),
  };

  let response;
  try {
    response = await fetch(TEXTBEE_SEND_SMS_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new SmsProviderError(
      `Textbee SMS request failed: ${error?.name === 'TimeoutError' ? 'timed out' : 'network error'}`,
      { status: 503, code: error?.name === 'TimeoutError' ? 'provider_timeout' : 'provider_network_error' },
    );
  }

  const rawBody = await response.text();
  let data = {};
  try {
    data = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    data = {};
  }
  const result = data?.data ?? data;

  if (!response.ok || result?.success === false) {
    if (response.status === 401 || response.status === 403) {
      throw new SmsProviderError('SMS provider authentication failed', {
        status: 503,
        code: 'provider_authentication_failed',
      });
    }
    if (response.status === 429) {
      throw new SmsProviderError('SMS provider rate limit reached', {
        status: 429,
        code: 'provider_rate_limited',
      });
    }
    if (response.status >= 400 && response.status < 500) {
      throw new SmsProviderError(`SMS provider rejected the recipient or message: ${getErrorMessage(data)}`, {
        status: 400,
        code: 'provider_rejected_request',
      });
    }
    throw new SmsProviderError(`Failed to send SMS: ${getErrorMessage(data)}`, {
      status: 503,
      code: 'provider_unavailable',
    });
  }
  return result;
}
