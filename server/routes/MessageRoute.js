import express from 'express';
import auth from '../middleware/auth.js';
import MessageController from '../controllers/MessageController.js';

const router = express.Router();
// Send a message
router.post('/', auth, MessageController.sendMessage);
// Backward-compatible send endpoint (mobile)
router.post('/send', auth, MessageController.sendMessage);
// Get all conversations for logged-in user
router.get('/conversations', auth, MessageController.getConversations);
// Get messages between two users (optionally for a job)
router.get('/', auth, MessageController.getMessages);
// Get messages between logged-in user and another user (for chat UI)
router.get('/conversation/:otherUserId', auth, MessageController.getConversationWithUser);
// Mark messages as read
router.patch('/read', auth, MessageController.markAsRead);

export default router;
