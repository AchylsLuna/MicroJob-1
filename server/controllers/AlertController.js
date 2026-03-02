import Alert from "../models/Alert.js";

const getUserId = (req) => req.user?.id || req.user?.userId;

export async function listAlerts(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const { status, severity, category, limit } = req.query;
    const filter = { user: userId };

    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (category) filter.category = category;

    const safeLimit = Math.min(Number.parseInt(limit || "50", 10) || 50, 200);

    const alerts = await Alert.find(filter).sort({ createdAt: -1 }).limit(safeLimit).lean();
    return res.status(200).json(alerts);
  } catch (error) {
    console.error("List alerts error:", error);
    return res.status(500).json({ message: "Failed to load alerts." });
  }
}

export async function updateAlertStatus(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const { alertId } = req.params;
    const { status } = req.body || {};

    const allowed = ["open", "snoozed", "resolved"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const updated = await Alert.findOneAndUpdate(
      { _id: alertId, user: userId },
      { $set: { status } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Alert not found." });
    }

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Update alert status error:", error);
    return res.status(500).json({ message: "Failed to update alert status." });
  }
}

export async function deleteAlert(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const { alertId } = req.params;
    const result = await Alert.deleteOne({ _id: alertId, user: userId });

    if (!result.deletedCount) {
      return res.status(404).json({ message: "Alert not found." });
    }

    return res.status(200).json({ message: "Alert deleted." });
  } catch (error) {
    console.error("Delete alert error:", error);
    return res.status(500).json({ message: "Failed to delete alert." });
  }
}
