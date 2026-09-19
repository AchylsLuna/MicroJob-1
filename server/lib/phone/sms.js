const TEXTBEE_BASE_URL = 'https://api.textbee.dev/api/v1/gateway/send-sms';

export async function sendSMS(phoneNumber, message) {
  if (!process.env.TEXTBEE_API_KEY) throw new Error('TEXTBEE_API_KEY is not set');
  if (!process.env.TEXTBEE_DEVICE_ID) throw new Error('TEXTBEE_DEVICE_ID is not set');

  const response = await fetch(TEXTBEE_BASE_URL, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.TEXTBEE_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      device_id: process.env.TEXTBEE_DEVICE_ID,
      recipients: [phoneNumber],
      message,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Failed to send SMS: ${data.message || 'Unknown error'}`);
  return data;
}
