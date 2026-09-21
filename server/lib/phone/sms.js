const TEXTBEE_SEND_SMS_URL = 'https://api.textbee.dev/api/v1/gateway/send-sms';

const getErrorMessage = (payload) => {
  const result = payload?.data ?? payload;
  return result?.message || payload?.message || payload?.error?.message || 'Textbee rejected the SMS request';
};

export async function sendSMS(phoneNumber, message) {
  const apiKey = process.env.TEXTBEE_API_KEY?.trim();
  const deviceId = process.env.TEXTBEE_DEVICE_ID?.trim();
  if (!apiKey) throw new Error('TEXTBEE_API_KEY is not set');

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
    throw new Error(`Textbee SMS request failed: ${error?.name === 'TimeoutError' ? 'timed out' : 'network error'}`);
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
    throw new Error(`Failed to send SMS: ${getErrorMessage(data)}`);
  }
  return result;
}
