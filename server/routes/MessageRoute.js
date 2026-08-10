import express from 'express';
import auth from '../middleware/auth.js';
import MessageController from '../controllers/MessageController.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();
const messageWriteLimiter = rateLimit({
  windowMs: Math.max(1000, Number(process.env.MESSAGE_RATE_WINDOW_MS) || 60_000),
  limit: Math.max(1, Number(process.env.MESSAGE_RATE_LIMIT) || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many message requests. Please wait and try again.' },
});
// Send a message
router.post('/', messageWriteLimiter, auth, MessageController.sendMessage);
// Backward-compatible alias for older deployed clients; new clients use POST /api/messages.
router.post('/send', messageWriteLimiter, auth, MessageController.sendMessage);
// Get all conversations for logged-in user
router.get('/conversations', auth, MessageController.getConversations);
// Get messages between two users (optionally for a job)
router.get('/', auth, MessageController.getMessages);
// Get messages between logged-in user and another user (for chat UI)
router.get('/conversation/:otherUserId', auth, MessageController.getConversationWithUser);
// Mark messages as read
router.patch('/read', auth, MessageController.markAsRead);
// Edit a sent message (30-second window)
router.patch('/edit/:messageId', messageWriteLimiter, auth, MessageController.editMessage);

// Block a user (current user blocks otherUserId)
router.post('/block', auth, MessageController.blockUser);
router.post('/unblock', auth, MessageController.unblockUser);

// Archive a conversation for the current user
router.post('/archive', auth, MessageController.archiveConversation);

// Compatibility route; only removes the conversation for the authenticated user.
router.delete('/conversation', auth, MessageController.deleteConversationForBoth);

// Get blocked users for current user
router.get('/blocked', auth, MessageController.getBlockedUsers);
router.get('/archived', auth, MessageController.getArchivedConversations);

export default router;
