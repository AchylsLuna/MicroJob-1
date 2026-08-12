import Notification from '../models/Notification.js';
import PushDevice from '../models/PushDevice.js';

const getUserId = (req) => req.user?.id || req.user?.userId;

export async function listNotifications(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const { unread, type, limit, entityType } = req.query;
    const filter = { user: userId };

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

    const safeLimit = Math.min(Number.parseInt(limit || '50', 10) || 50, 200);

    const notifications = await Notification.find(filter)
      .populate('actor', 'firstName lastName email role status')
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean();

    return res.status(200).json(notifications);
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

    const { notificationId } = req.params;
    const updated = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { $set: { readAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

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
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, user: userId },
      { $set: { readAt: null } },
      { returnDocument: 'after' }
    );
    if (!updated) return res.status(404).json({ message: 'Notification not found.' });
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

    await Notification.updateMany(
      { user: userId, readAt: null },
      { $set: { readAt: new Date() } }
    );

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

    const { notificationId } = req.params;
    const result = await Notification.deleteOne({ _id: notificationId, user: userId });

    if (!result.deletedCount) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

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

    await Notification.deleteMany({ user: userId, readAt: { $ne: null } });
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
    if (!token || !String(token).trim()) {
      return res.status(400).json({ message: 'Push token is required.' });
    }
    if (platform !== 'expo') {
      return res.status(400).json({ message: 'Unsupported push platform.' });
    }

    const device = await PushDevice.findOneAndUpdate(
      { user: userId, token: String(token).trim() },
      {
        $set: {
          platform,
          deviceName: deviceName ? String(deviceName).trim() : null,
          active: true,
          lastSeenAt: new Date(),
        },
        $setOnInsert: {
          user: userId,
          token: String(token).trim(),
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
