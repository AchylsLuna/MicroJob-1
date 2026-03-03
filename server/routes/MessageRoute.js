import express from 'express';
import auth from '../middleware/auth.js';
import MessageController from '../controllers/MessageController.js';

const router = express.Router();
// Send a message
router.post('/', auth, MessageController.sendMessage);
router.post('/send', auth, MessageController.sendMessage);
// Get all conversations for logged-in user
router.get('/conversations', auth, MessageController.getConversations);
// Get messages between two users (optionally for a job)
router.get('/', auth, MessageController.getMessages);
// Get messages between logged-in user and another user (for chat UI)
router.get('/conversation/:otherUserId', auth, MessageController.getConversationWithUser);
// Mark messages as read
router.patch('/read', auth, MessageController.markAsRead);
// Edit a sent message (30-second window)
router.patch('/edit/:messageId', auth, MessageController.editMessage);

// Block a user (current user blocks otherUserId)
router.post('/block', auth, MessageController.blockUser);
router.post('/unblock', auth, MessageController.unblockUser);

// Archive a conversation for the current user
router.post('/archive', auth, MessageController.archiveConversation);

// Delete conversation for both users (dangerous: removes messages)
router.delete('/conversation', auth, MessageController.deleteConversationForBoth);

// Get blocked users for current user
router.get('/blocked', auth, MessageController.getBlockedUsers);
router.get('/archived', auth, MessageController.getArchivedConversations);

export default router;
