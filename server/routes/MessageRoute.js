import express from 'express';
import auth from '../middleware/auth.js';
import { requirePermission } from '../middleware/admin.js';
import { getMessageRecipients } from '../controllers/MessageRecipientController.js';
import MessageController from '../controllers/MessageController.js';
import { reportConversation } from '../controllers/MessageReportController.js';
import { createRateLimiter, buildUserRateLimitKey } from '../lib/rateLimiters.js';

const router = express.Router();
const messageWriteLimiter = createRateLimiter({
  windowMs: Math.max(1000, Number(process.env.MESSAGE_RATE_WINDOW_MS) || 60_000),
  limit: Math.max(1, Number(process.env.MESSAGE_RATE_LIMIT) || 30),
  message: { message: 'Too many message requests. Please wait and try again.' },
  keyGenerator: buildUserRateLimitKey('message-write'),
});
// Directory access is separate from reading one's own conversations.
router.get('/recipients', auth, requirePermission('messages.recipients.view'), getMessageRecipients);
// Send a message
router.post('/', auth, messageWriteLimiter, MessageController.sendMessage);
// Backward-compatible alias for older deployed clients; new clients use POST /api/messages.
router.post('/send', auth, messageWriteLimiter, MessageController.sendMessage);
// Open a job inquiry thread with the employer who posted the job.
router.post('/inquiries/:jobId', auth, messageWriteLimiter, MessageController.startJobInquiry);
router.post('/report', auth, messageWriteLimiter, reportConversation);

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

// Removes the conversation for the authenticated user only. The counterparty
// keeps their copy (Message.deletedFor); the document is purged once both sides
// have deleted it.
router.delete('/conversation', auth, MessageController.deleteConversationForMe);

// Get blocked users for current user
router.get('/blocked', auth, MessageController.getBlockedUsers);
router.get('/archived', auth, MessageController.getArchivedConversations);

export default router;
