import Notification from "../models/Notification.js";

const getUserId = (req) => req.user?.id || req.user?.userId;

export async function listNotifications(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const { unread, type, limit } = req.query;
    const filter = { user: userId };

    if (unread === "true") {
      filter.readAt = null;
    }
    if (unread === "false") {
      filter.readAt = { $ne: null };
    }
    if (type) {
      filter.type = type;
    }

    const safeLimit = Math.min(Number.parseInt(limit || "50", 10) || 50, 200);

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean();

    return res.status(200).json(notifications);
  } catch (error) {
    console.error("List notifications error:", error);
    return res.status(500).json({ message: "Failed to load notifications." });
  }
}

export async function markNotificationRead(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const { notificationId } = req.params;
    const updated = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { $set: { readAt: new Date() } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Notification not found." });
    }

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Mark notification read error:", error);
    return res.status(500).json({ message: "Failed to mark notification as read." });
  }
}

export async function markAllNotificationsRead(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    await Notification.updateMany(
      { user: userId, readAt: null },
      { $set: { readAt: new Date() } }
    );

    return res.status(200).json({ message: "All notifications marked as read." });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    return res.status(500).json({ message: "Failed to mark all notifications as read." });
  }
}

export async function deleteNotification(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const { notificationId } = req.params;
    const result = await Notification.deleteOne({ _id: notificationId, user: userId });

    if (!result.deletedCount) {
      return res.status(404).json({ message: "Notification not found." });
    }

    return res.status(200).json({ message: "Notification deleted." });
  } catch (error) {
    console.error("Delete notification error:", error);
    return res.status(500).json({ message: "Failed to delete notification." });
  }
}

export async function deleteReadNotifications(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    await Notification.deleteMany({ user: userId, readAt: { $ne: null } });
    return res.status(200).json({ message: "Read notifications deleted." });
  } catch (error) {
    console.error("Delete read notifications error:", error);
    return res.status(500).json({ message: "Failed to delete read notifications." });
  }
}
