import Notification from '../models/Notification.js';
import PushDevice from '../models/PushDevice.js';
import { emitToUser } from '../lib/socket.js';
import mongoose from 'mongoose';

const getUserId = (req) => req.user?.id || req.user?.userId;
const resolveMode = (req, res) => {
  const role = String(req.user?.role || '').toLowerCase();
  const requested = String(req.query?.mode || req.body?.mode || '').toLowerCase();
  const fallback = ['hire', 'employer'].includes(role) ? 'employer' : 'worker';
  const mode = requested || fallback;
  if (!['worker', 'employer'].includes(mode)) {
    res.status(400).json({ message: 'Notification mode must be worker or employer.' });
    return null;
  }
  if (mode === 'employer' && !['hire', 'employer', 'both'].includes(role)) {
    res.status(403).json({ message: 'Employer notifications are not available for this account.' });
    return null;
  }
  if (mode === 'worker' && !['work', 'worker', 'user', 'both'].includes(role)) {
    res.status(403).json({ message: 'Worker notifications are not available for this account.' });
    return null;
  }
  return mode;
};
const modeFilter = (userId, mode) => ({ user: userId, audience: { $in: [mode, 'shared', null] } });
const emitReconcile = (userId, mode, action, notification = null) => {
  emitToUser(String(userId), 'notification_changed', {
    mode,
    action,
    notification: notification?.toObject ? notification.toObject() : notification,
  });
};

export async function listNotifications(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const mode = resolveMode(req, res);
    if (!mode) return;
    const { unread, type, limit, entityType, cursor } = req.query;
    const filter = modeFilter(userId, mode);

    if (unread === 'true') {
      filter.readAt = null;
    }
    if (unread === 'false') {
      filter.readAt = { $ne: null };
    }
    if (type) {
      filter.type = type;
    }
    if (entityType) {
      filter.entityType = entityType;
    }
    if (cursor) {
      if (!mongoose.isValidObjectId(cursor)) return res.status(400).json({ message: 'Invalid notification cursor.' });
      filter._id = { $lt: cursor };
    }

    const safeLimit = Math.min(Number.parseInt(limit || '50', 10) || 50, 200);

    const notifications = await Notification.find(filter)
      .populate('actor', 'firstName lastName email role status')
      .sort({ _id: -1 })
      .limit(safeLimit + 1)
      .lean();
    const hasMore = notifications.length > safeLimit;
    const items = hasMore ? notifications.slice(0, safeLimit) : notifications;
    const unreadCount = await Notification.countDocuments({ ...modeFilter(userId, mode), readAt: null });
    return res.status(200).json({
      notifications: items,
      unreadCount,
      nextCursor: hasMore ? String(items.at(-1)?._id || '') : null,
    });
  } catch (error) {
    console.error('List notifications error:', error);
    return res.status(500).json({ message: 'Failed to load notifications.' });
  }
}

export async function markNotificationRead(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    const mode = resolveMode(req, res);
    if (!mode) return;
    const { notificationId } = req.params;
    const updated = await Notification.findOneAndUpdate(
      { _id: notificationId, ...modeFilter(userId, mode) },
      { $set: { readAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    emitReconcile(userId, mode, 'read', updated);
    return res.status(200).json(updated);
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({ message: 'Failed to mark notification as read.' });
  }
}

export async function markNotificationUnread(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Authentication required.' });
    const mode = resolveMode(req, res);
    if (!mode) return;
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, ...modeFilter(userId, mode) },
      { $set: { readAt: null } },
      { returnDocument: 'after' }
    );
    if (!updated) return res.status(404).json({ message: 'Notification not found.' });
    emitReconcile(userId, mode, 'unread', updated);
    return res.status(200).json(updated);
  } catch (error) {
    console.error('Mark notification unread error:', error);
    return res.status(500).json({ message: 'Failed to mark notification as unread.' });
  }
}

export async function markAllNotificationsRead(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    const mode = resolveMode(req, res);
    if (!mode) return;
    await Notification.updateMany(
      { ...modeFilter(userId, mode), readAt: null },
      { $set: { readAt: new Date() } }
    );

    emitReconcile(userId, mode, 'read-all');
    return res.status(200).json({ message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return res.status(500).json({ message: 'Failed to mark all notifications as read.' });
  }
}

export async function deleteNotification(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    const mode = resolveMode(req, res);
    if (!mode) return;
    const { notificationId } = req.params;
    const result = await Notification.deleteOne({ _id: notificationId, ...modeFilter(userId, mode) });

    if (!result.deletedCount) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    emitReconcile(userId, mode, 'deleted', { _id: notificationId });
    return res.status(200).json({ message: 'Notification deleted.' });
  } catch (error) {
    console.error('Delete notification error:', error);
    return res.status(500).json({ message: 'Failed to delete notification.' });
  }
}

export async function deleteReadNotifications(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    const mode = resolveMode(req, res);
    if (!mode) return;
    await Notification.deleteMany({ ...modeFilter(userId, mode), readAt: { $ne: null } });
    emitReconcile(userId, mode, 'clear-read');
    return res.status(200).json({ message: 'Read notifications deleted.' });
  } catch (error) {
    console.error('Delete read notifications error:', error);
    return res.status(500).json({ message: 'Failed to delete read notifications.' });
  }
}

export async function registerPushDevice(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { token, deviceName, platform = 'expo' } = req.body || {};
    const normalizedToken = String(token || '').trim();
    if (!/^Expo(?:nent)?PushToken\[[^\]]{1,400}\]$/.test(normalizedToken)) {
      return res.status(400).json({ message: 'A valid Expo push token is required.' });
    }
    if (platform !== 'expo') {
      return res.status(400).json({ message: 'Unsupported push platform.' });
    }

    await PushDevice.deleteMany({ token: normalizedToken, user: { $ne: userId } });

    const device = await PushDevice.findOneAndUpdate(
      { user: userId, token: normalizedToken },
      {
        $set: {
          platform,
          deviceName: deviceName ? String(deviceName).trim() : null,
          active: true,
          lastSeenAt: new Date(),
        },
        $setOnInsert: {
          user: userId,
          token: normalizedToken,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    return res.status(201).json({ message: 'Push device registered.', device });
  } catch (error) {
    console.error('Register push device error:', error);
    return res.status(500).json({ message: 'Failed to register push device.' });
  }
}

export async function removePushDevice(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { deviceId } = req.params;
    if (!mongoose.isValidObjectId(deviceId)) return res.status(400).json({ message: 'Invalid push device ID.' });
    const result = await PushDevice.findOneAndDelete({ _id: deviceId, user: userId });
    if (!result) {
      return res.status(404).json({ message: 'Push device not found.' });
    }

    return res.status(200).json({ message: 'Push device removed.' });
  } catch (error) {
    console.error('Remove push device error:', error);
    return res.status(500).json({ message: 'Failed to remove push device.' });
  }
}
