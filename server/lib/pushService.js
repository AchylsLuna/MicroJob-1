import axios from 'axios';
import PushDevice from '../models/PushDevice.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const isExpoToken = (value = '') => /^ExponentPushToken\[.+\]$|^ExpoPushToken\[.+\]$/.test(String(value));

export async function sendExpoPushToUser(userId, payload = {}) {
  if (!userId) return { attempted: false, sent: 0 };

  const devices = await PushDevice.find({ user: userId, active: true, platform: 'expo' }).lean();
  const eligibleDevices = devices.filter((device) => isExpoToken(device.token));
  const messages = eligibleDevices.map((device) => ({
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
    const response = await axios.post(EXPO_PUSH_URL, messages, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    const tickets = Array.isArray(response?.data?.data) ? response.data.data : [];
    const invalidDeviceIds = tickets.flatMap((ticket, index) =>
      ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered' && eligibleDevices[index]?._id
        ? [eligibleDevices[index]._id]
        : []
    );
    if (invalidDeviceIds.length) {
      await PushDevice.updateMany({ _id: { $in: invalidDeviceIds } }, { $set: { active: false } });
    }
    return { attempted: true, sent: messages.length - invalidDeviceIds.length };
  } catch (error) {
    const status = error?.response?.status;
    console.warn('Expo push delivery failed:', status ? `HTTP ${status}` : (error?.code || error?.message || 'push_failed'));
    return {
      attempted: true,
      sent: 0,
      error: status ? `HTTP ${status}` : (error?.code || 'push_failed'),
    };
  }
}
