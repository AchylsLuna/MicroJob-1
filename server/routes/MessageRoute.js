import express from 'express';
import auth from '../middleware/auth.js';
import MessageController from '../controllers/MessageController.js';
import { createRateLimiter, buildUserRateLimitKey } from '../lib/rateLimiters.js';

const router = express.Router();
const messageWriteLimiter = createRateLimiter({
  windowMs: Math.max(1000, Number(process.env.MESSAGE_RATE_WINDOW_MS) || 60_000),
  limit: Math.max(1, Number(process.env.MESSAGE_RATE_LIMIT) || 30),
  message: { message: 'Too many message requests. Please wait and try again.' },
  keyGenerator: buildUserRateLimitKey('message-write'),
});
// Send a message
router.post('/', auth, messageWriteLimiter, MessageController.sendMessage);
// Backward-compatible alias for older deployed clients; new clients use POST /api/messages.
router.post('/send', auth, messageWriteLimiter, MessageController.sendMessage);
// Open a job inquiry thread with the employer who posted the job.
router.post('/inquiries/:jobId', auth, messageWriteLimiter, MessageController.startJobInquiry);

// Get all conversations for logged-in user
router.get('/conversations', auth, MessageController.getConversations);
// Get messages between two users (optionally for a job)
router.get('/', auth, MessageController.getMessages);
// Get messages between logged-in user and another user (for chat UI)
router.get('/conversation/:otherUserId', auth, MessageController.getConversationWithUser);
// Mark messages as read
router.patch('/read', auth, MessageController.markAsRead);
// Edit a sent message (30-second window)
router.patch('/edit/:messageId', auth, messageWriteLimiter, MessageController.editMessage);

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
