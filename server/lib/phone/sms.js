const TEXTBEE_BASE_URL = 'https://api.textbee.dev/api/v1/gateway/devices';


export async function sendSMS(phoneNumber, message) {
    if (!process.env.TEXTBEE_API_KEY) {
        throw new Error('API KEY is not set');
    }
    if (!process.env.TEXTBEE_DEVICE_ID) {
        throw new Error('DEVICE ID is not set');
    }
    const res = await fetch (`${TEXTBEE_BASE_URL}/${process.env.TEXTBEE_DEVICE_ID}/send-sms`, {
        method: 'POST',
        headers: {
            'x-api-key': process.env.TEXTBEE_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipients: [phoneNumber],
            message,
        }),
    }); 

    const data = await res.json();
    if (!res.ok) {
        throw new Error(`Failed to send SMS: ${data.message || 'Unknown error'}`);
    }
    return data;
}