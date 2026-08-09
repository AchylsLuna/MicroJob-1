const TEXTBEE_BASE_URL = 'https://api.textbee.dev/api/v1/gateway/send-sms';


export async function sendSMS(phoneNumber, message) {
    if (!process.env.TEXTBEE_API_KEY) {
        throw new Error('API KEY is not set');
    }
    if (!process.env.TEXTBEE_DEVICE_ID) {
        throw new Error('DEVICE ID is not set');
    }
    const res = await fetch (TEXTBEE_BASE_URL, {
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

    const data = await res.json();
    if (!res.ok) {
        throw new Error(`Failed to send SMS: ${data.message || 'Unknown error'}`);
    }
    return data;
}