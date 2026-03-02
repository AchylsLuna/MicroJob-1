import { Router } from "express";
import auth from "../middleware/auth.js";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteReadNotifications,
} from "../controllers/NotificationController.js";

const router = Router();

router.get("/", auth, listNotifications);
router.patch("/read-all", auth, markAllNotificationsRead);
router.patch("/:notificationId/read", auth, markNotificationRead);
router.delete("/read", auth, deleteReadNotifications);
router.delete("/:notificationId", auth, deleteNotification);

export default router;
