import Notification from '../models/Notification.js';
import { emitToUser } from './socket.js';
import { sendExpoPushToUser } from './pushService.js';

const normalizeEntityId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

export async function createNotification({
  deliveryKey,
  retryPush = false,
  userId,
  type = 'system',
  audience = 'shared',
  title,
  message,
  link = '',
  entityType = null,
  entityId = null,
  actor = null,
  metadata = {},
  socketEvent = 'notification_created',
  socketPayload = null,
  push = true,
  pushTitle = null,
  pushBody = null,
  pushData = null,
} = {}) {
  if (!userId || !title || !message) {
    throw new Error('userId, title, and message are required to create a notification');
  }

  const values = {
    ...(deliveryKey ? { deliveryKey } : {}),
    user: userId,
    type,
    audience,
    title,
    message,
    link,
    entityType,
    entityId: normalizeEntityId(entityId),
    actor: actor || null,
    metadata: metadata || {},
  };
  const notification = deliveryKey
    ? await Notification.findOneAndUpdate({ deliveryKey }, { $setOnInsert: values }, { upsert: true, returnDocument: 'after' })
    : await Notification.create(values);

  const leanNotification = notification.toObject();
  // Always emit the full notification object and include any socketPayload
  const emitPayload = { notification: leanNotification, socketPayload: socketPayload || null };
  emitToUser(String(userId), 'notification_created', emitPayload);
  if (socketEvent && socketEvent !== 'notification_created') {
    emitToUser(String(userId), socketEvent, socketPayload || emitPayload);
  }

  if (push && !notification.pushDeliveredAt) {
    try {
      const canonicalPushData = {
        notificationId: String(notification._id),
        type,
        audience,
        entityType,
        entityId: normalizeEntityId(entityId),
        link,
        ...(pushData || {}),
      };
      const result = await sendExpoPushToUser(userId, {
        title: pushTitle || title,
        body: pushBody || message,
        data: canonicalPushData,
      });
      if (result?.error) throw new Error(result.error);
      await Notification.updateOne({ _id: notification._id }, { $set: { pushDeliveredAt: new Date() } });
    } catch (error) {
      if (retryPush) throw error;
      console.warn('Notification push failed:', error?.message || error);
    }
  }

  return notification;
}
