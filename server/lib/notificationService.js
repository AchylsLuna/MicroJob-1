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
  title,
  message,
  link = '',
  entityType = null,
  entityId = null,
  actor = null,
  metadata = {},
  dedupeKey = null,
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

  let notification;
  try {
    notification = await Notification.create({
      user: userId,
      type,
      title,
      message,
      link,
      entityType,
      entityId: normalizeEntityId(entityId),
      actor: actor || null,
      metadata: metadata || {},
      dedupeKey: dedupeKey ? String(dedupeKey).trim() : null,
    });
  } catch (error) {
    if (error?.code !== 11000 || !dedupeKey) throw error;
    return Notification.findOne({ user: userId, dedupeKey: String(dedupeKey).trim() });
  }

  if (actor) {
    await notification.populate('actor', 'firstName lastName companyName email role status');
  }

  const leanNotification = notification.toObject();
  // Always emit the full notification object and include any socketPayload
  const emitPayload = { notification: leanNotification, socketPayload: socketPayload || null };
  emitToUser(String(userId), socketEvent, emitPayload);
  if (socketEvent !== 'notification_created') {
    emitToUser(String(userId), 'notification_created', emitPayload);
  }

  if (push) {
    try {
      await sendExpoPushToUser(userId, {
        title: pushTitle || title,
        body: pushBody || message,
        data: pushData || {
          notificationId: String(notification._id),
          type,
          entityType,
          entityId: normalizeEntityId(entityId),
          link,
        },
      });
    } catch (error) {
      console.warn('Notification push failed:', error?.message || error);
    }
  }

  return notification;
}
