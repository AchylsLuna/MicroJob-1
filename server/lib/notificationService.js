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

  const notification = await Notification.create({
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
  });

  const leanNotification = notification.toObject();
  // Always emit the full notification object and include any socketPayload
  const emitPayload = { notification: leanNotification, socketPayload: socketPayload || null };
  emitToUser(String(userId), 'notification_created', emitPayload);
  if (socketEvent && socketEvent !== 'notification_created') {
    emitToUser(String(userId), socketEvent, socketPayload || emitPayload);
  }

  if (push) {
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
      await sendExpoPushToUser(userId, {
        title: pushTitle || title,
        body: pushBody || message,
        data: canonicalPushData,
      });
    } catch (error) {
      console.warn('Notification push failed:', error?.message || error);
    }
  }

  return notification;
}
