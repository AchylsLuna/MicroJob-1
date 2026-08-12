import { Router } from 'express';
import auth from '../middleware/auth.js';
import {
  listNotifications,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  deleteNotification,
  deleteReadNotifications,
  registerPushDevice,
  removePushDevice,
} from '../controllers/NotificationController.js';

const router = Router();

router.get('/', auth, listNotifications);
router.patch('/read-all', auth, markAllNotificationsRead);
router.post('/devices', auth, registerPushDevice);
router.delete('/devices/:deviceId', auth, removePushDevice);
router.patch('/:notificationId/read', auth, markNotificationRead);
router.patch('/:notificationId/unread', auth, markNotificationUnread);
router.delete('/read', auth, deleteReadNotifications);
router.delete('/:notificationId', auth, deleteNotification);

export default router;
