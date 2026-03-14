import axios from 'axios';
import PushDevice from '../models/PushDevice.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const isExpoToken = (value = '') => /^ExponentPushToken\[.+\]$|^ExpoPushToken\[.+\]$/.test(String(value));

export async function sendExpoPushToUser(userId, payload = {}) {
  if (!userId) return { attempted: false, sent: 0 };

  const devices = await PushDevice.find({ user: userId, active: true, platform: 'expo' }).lean();
  const messages = devices
    .filter((device) => isExpoToken(device.token))
    .map((device) => ({
      to: device.token,
      sound: 'default',
      title: payload.title || 'MicroJobs',
      body: payload.body || '',
      data: payload.data || {},
    }));

  if (!messages.length) {
    return { attempted: false, sent: 0 };
  }

  try {
    await axios.post(EXPO_PUSH_URL, messages, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    return { attempted: true, sent: messages.length };
  } catch (error) {
    console.warn('Expo push delivery failed:', error?.response?.data || error?.message || error);
    return {
      attempted: true,
      sent: 0,
      error: error?.response?.data || error?.message || 'push_failed',
    };
  }
}
