import Message from '../models/Message.js';
import User from '../models/User.js';
import { emitToUser } from '../lib/socket.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import { isValidObjectId, validateMessageContent } from '../lib/messageSecurity.js';

const getAuthUserId = (req) => req.user?.id || req.user?._id || req.user?.userId || null;

const toIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && '_id' in value && value._id) return String(value._id);
  return String(value);
};

const getDisplayName = (user) => {
  if (!user || typeof user !== 'object') return 'User';
  const firstName = typeof user.firstName === 'string' ? user.firstName.trim() : '';
  const lastName = typeof user.lastName === 'string' ? user.lastName.trim() : '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || 'User';
};

const normalizeOptionalJobId = (jobId) => {
  if (!jobId || jobId === 'null' || jobId === 'undefined') return null;
  return jobId;
};

const EDIT_WINDOW_MS = 30 * 1000;

const withMessagePopulate = (query) =>
  query
    .populate('sender', 'firstName lastName')
    .populate('receiver', 'firstName lastName')
    .populate('job', 'title')
    .populate('attachment.settlementRequest', 'status expiresAt settledAt')
    .populate('attachment.jobOffer', 'status amount acceptedAt resolvedAt');

const getConversationWithUser = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { otherUserId } = req.params;
    const jobId = normalizeOptionalJobId(req.query?.jobId);
    if (!userId) return sendError(res, 401, 'Authentication required.');
    if (!otherUserId) return sendError(res, 400, 'otherUserId required');

    const filter = {
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId },
      ],
    };
    if (jobId) filter.job = jobId;

    const messages = await withMessagePopulate(Message.find(filter)).sort({ createdAt: 1 });
    return sendSuccess(res, 200, 'Messages retrieved', messages, { messages });
  } catch (error) {
    return sendError(res, 500, 'Server error', { error: error.message });
  }
};

const MessageController = {
  // Send a message from employer to worker or vice versa
  sendMessage: async (req, res) => {
    try {
      const { receiverId, content, jobId, clientMessageId } = req.body;
      const senderId = getAuthUserId(req);
      const { content: trimmedContent, error: contentError } = validateMessageContent(content);
      const normalizedJobId = normalizeOptionalJobId(jobId);

      if (!senderId) {
        return sendError(res, 401, 'Authentication required.');
      }
      if (!receiverId || !isValidObjectId(receiverId)) {
        return sendError(res, 400, 'A valid receiver is required.');
      }
      if (contentError) return sendError(res, 400, contentError);
      if (normalizedJobId && !isValidObjectId(normalizedJobId)) {
        return sendError(res, 400, 'A valid job is required.');
      }
      const normalizedClientMessageId = typeof clientMessageId === 'string'
        ? clientMessageId.trim().slice(0, 100)
        : '';

      if (normalizedClientMessageId) {
        const existing = await Message.findOne({ sender: senderId, clientMessageId: normalizedClientMessageId });
        if (existing) {
          const hydratedExisting = await withMessagePopulate(Message.findById(existing._id));
          const payload = hydratedExisting || existing;
          return sendSuccess(res, 200, 'Message already sent', payload, { data: payload, deduplicated: true });
        }
      }

      // Prevent self-messaging
      if (String(senderId) === String(receiverId)) {
        return sendError(res, 400, 'You cannot message yourself.');
      }

      const receiver = await User.findById(receiverId).select('blockedUsers');
      if (!receiver) {
        return sendError(res, 404, 'Receiver not found.');
      }

      // If the receiver has blocked the sender, disallow sending
      const blocked = Array.isArray(receiver.blockedUsers) && receiver.blockedUsers.some((id) => String(id) === String(senderId));
      if (blocked) {
        return sendError(res, 403, 'You are blocked by this user.');
      }

      let message;
      try {
        message = await Message.create({
          sender: senderId,
          receiver: receiverId,
          job: normalizedJobId || undefined,
          content: trimmedContent,
          clientMessageId: normalizedClientMessageId || undefined,
        });
      } catch (error) {
        if (error?.code !== 11000 || !normalizedClientMessageId) throw error;
        const existing = await Message.findOne({ sender: senderId, clientMessageId: normalizedClientMessageId });
        if (!existing) throw error;
        const hydratedExisting = await withMessagePopulate(Message.findById(existing._id));
        const payload = hydratedExisting || existing;
        return sendSuccess(res, 200, 'Message already sent', payload, { data: payload, deduplicated: true });
      }

      const conversationKey = `${receiverId}::${normalizedJobId || 'general'}`;
      const reverseConversationKey = `${senderId}::${normalizedJobId || 'general'}`;
      await Promise.all([
        User.updateOne({ _id: senderId }, { $pull: { archivedConversations: conversationKey } }),
        User.updateOne({ _id: receiverId }, { $pull: { archivedConversations: reverseConversationKey } }),
      ]);

      const hydratedMessage = await withMessagePopulate(Message.findById(message._id));
      // Emit real-time event to the receiver (and optionally to the sender)
      try {
        const payload = hydratedMessage || message;
        emitToUser(receiverId, 'new_message', payload);
        emitToUser(senderId, 'new_message_echo', payload);
      } catch (e) {
        // ignore emit errors
      }

      const payload = hydratedMessage || message;
      return sendSuccess(res, 201, 'Message sent', payload, { data: payload });
    } catch (error) {
      return sendError(res, 500, 'Server error', { error: error.message });
    }
  },

  editMessage: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { messageId } = req.params;
      const { content } = req.body || {};
      const { content: trimmedContent, error: contentError } = validateMessageContent(content);

      if (!userId) return sendError(res, 401, 'Authentication required.');
      if (!messageId || !isValidObjectId(messageId)) return sendError(res, 400, 'A valid messageId is required.');
      if (contentError) return sendError(res, 400, contentError);

      const message = await Message.findById(messageId);
      if (!message) return sendError(res, 404, 'Message not found.');

      if (String(message.sender) !== String(userId)) {
        return sendError(res, 403, 'You can only edit your own messages.');
      }
      if (message.attachment?.type === 'settlement_request') {
        return sendError(res, 400, 'Payment invoice messages cannot be edited.');
      }

      const createdAtMs = new Date(message.createdAt).getTime();
      const nowMs = Date.now();
      if (Number.isNaN(createdAtMs) || nowMs - createdAtMs > EDIT_WINDOW_MS) {
        return sendError(res, 400, 'Editing window expired. Messages can be edited within 30 seconds.');
      }

      message.content = trimmedContent;
      message.isEdited = true;
      message.editedAt = new Date();
      await message.save();

      const hydratedMessage = await withMessagePopulate(Message.findById(message._id));
      const payload = hydratedMessage || message;

      try {
        const receiverId = toIdString(payload.receiver || message.receiver);
        emitToUser(receiverId, 'message_edited', payload);
        emitToUser(userId, 'message_edited', payload);
      } catch (e) {
        // ignore emit errors
      }

      return sendSuccess(res, 200, 'Message updated', payload, { data: payload });
    } catch (error) {
      return sendError(res, 500, 'Server error', { error: error.message });
    }
  },

  // Get all conversations for the logged-in user
  getConversations: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) return sendError(res, 401, 'Authentication required.');

      const currentUser = await User.findById(userId).select('archivedConversations');
      const archivedSet = new Set(
        Array.isArray(currentUser?.archivedConversations)
          ? currentUser.archivedConversations.map((id) => String(id))
          : []
      );

      // Most recent first so the first hit per conversation key is the preview we need.
      const messages = await withMessagePopulate(
        Message.find({ $or: [{ sender: userId }, { receiver: userId }] })
      ).sort({ createdAt: -1 });

      const conversationMap = new Map();

      messages.forEach((msg) => {
        const senderId = toIdString(msg.sender);
        const receiverId = toIdString(msg.receiver);
        const isSenderCurrentUser = senderId === String(userId);
        const otherUser = isSenderCurrentUser ? msg.receiver : msg.sender;
        const otherUserId = isSenderCurrentUser ? receiverId : senderId;

        if (!otherUserId) return;

        const jobId = msg.job ? toIdString(msg.job) : null;
        const conversationId = `${otherUserId}::${jobId || 'general'}`;
        if (archivedSet.has(conversationId)) return;
        if (!conversationMap.has(conversationId)) {
          conversationMap.set(conversationId, {
            conversationId,
            otherUserId,
            otherUserName: getDisplayName(otherUser),
            jobId,
            jobTitle: msg.job?.title || null,
            lastMessage: msg.content || '',
            lastMessageAt: msg.createdAt,
            unreadCount: 0,
          });
        }
        if (!isSenderCurrentUser && msg.read !== true) {
          conversationMap.get(conversationId).unreadCount += 1;
        }
      });

      const conversations = Array.from(conversationMap.values());
      return sendSuccess(res, 200, 'Conversations retrieved', conversations, { conversations });
    } catch (error) {
      return sendError(res, 500, 'Server error', { error: error.message });
    }
  },

  // Get messages between two users (optionally for a job)
  getMessages: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { otherUserId, jobId } = req.query;
      const normalizedJobId = normalizeOptionalJobId(jobId);
      if (!userId) return sendError(res, 401, 'Authentication required.');
      if (!otherUserId) return sendError(res, 400, 'otherUserId required');
      const filter = {
        $or: [
          { sender: userId, receiver: otherUserId },
          { sender: otherUserId, receiver: userId },
        ],
      };
      if (normalizedJobId) filter.job = normalizedJobId;
      const messages = await withMessagePopulate(Message.find(filter)).sort({ createdAt: 1 });
      return sendSuccess(res, 200, 'Messages retrieved', messages, { messages });
    } catch (error) {
      return sendError(res, 500, 'Server error', { error: error.message });
    }
  },

  // Mark messages as read/unread
  markAsRead: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { otherUserId, jobId, read } = req.body;
      const normalizedJobId = normalizeOptionalJobId(jobId);
      if (!userId) return sendError(res, 401, 'Authentication required.');
      if (!otherUserId) return sendError(res, 400, 'otherUserId required');
      const filter = {
        sender: otherUserId,
        receiver: userId,
      };
      if (normalizedJobId) filter.job = normalizedJobId;
      const setRead = read === false ? false : true; // default to true
      await Message.updateMany(filter, { $set: { read: setRead } });
      return sendSuccess(
        res,
        200,
        setRead ? 'Messages marked as read' : 'Messages marked as unread',
        { otherUserId, read: setRead }
      );
    } catch (error) {
      return sendError(res, 500, 'Server error', { error: error.message });
    }
  },
  // Block another user
  blockUser: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { otherUserId } = req.body;
      if (!userId) return sendError(res, 401, 'Authentication required.');
      if (!otherUserId) return sendError(res, 400, 'otherUserId required');
      await User.updateOne({ _id: userId }, { $addToSet: { blockedUsers: otherUserId } });
      // notify the blocked user via socket that they were blocked by userId
      try {
        emitToUser(otherUserId, 'user_blocked', { blockerId: userId });
      } catch (e) {}
      return sendSuccess(res, 200, 'User blocked', { otherUserId });
    } catch (error) {
      return sendError(res, 500, 'Server error', { error: error.message });
    }
  },

  unblockUser: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { otherUserId } = req.body;
      if (!userId) return sendError(res, 401, 'Authentication required.');
      if (!otherUserId) return sendError(res, 400, 'otherUserId required');
      await User.updateOne({ _id: userId }, { $pull: { blockedUsers: otherUserId } });
      try {
        emitToUser(otherUserId, 'user_unblocked', { unblockedBy: userId });
      } catch (e) {}
      return sendSuccess(res, 200, 'User unblocked', { otherUserId });
    } catch (error) {
      return sendError(res, 500, 'Server error', { error: error.message });
    }
  },

  // Archive or unarchive a conversation for the current user
  archiveConversation: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { otherUserId, jobId, archive } = req.body;
      if (!userId) return sendError(res, 401, 'Authentication required.');
      if (!otherUserId) return sendError(res, 400, 'otherUserId required');
      const normalizedJobId = normalizeOptionalJobId(jobId);
      const convId = `${otherUserId}::${normalizedJobId || 'general'}`;
      if (archive) {
        await User.updateOne({ _id: userId }, { $addToSet: { archivedConversations: convId } });
        return sendSuccess(res, 200, 'Conversation archived', { conversationId: convId });
      }
      await User.updateOne({ _id: userId }, { $pull: { archivedConversations: convId } });
      return sendSuccess(res, 200, 'Conversation unarchived', { conversationId: convId });
    } catch (error) {
      return sendError(res, 500, 'Server error', { error: error.message });
    }
  },

  // Get list of users current user has blocked
  getBlockedUsers: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) return sendError(res, 401, 'Authentication required.');
      const user = await User.findById(userId).populate('blockedUsers', 'firstName lastName email');
      const blocked = (user?.blockedUsers || []).map((u) => ({ id: u._id, firstName: u.firstName, lastName: u.lastName, email: u.email }));
      return sendSuccess(res, 200, 'Blocked users retrieved', blocked, { blocked });
    } catch (error) {
      return sendError(res, 500, 'Server error', { error: error.message });
    }
  },
  // Get archived conversations for the current user
  getArchivedConversations: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) return sendError(res, 401, 'Authentication required.');
      const user = await User.findById(userId).select('archivedConversations');
      const archived = Array.isArray(user?.archivedConversations) ? user.archivedConversations : [];

      const results = [];
      for (const convId of archived) {
        // convId format: otherUserId::jobIdOrGeneral
        const parts = String(convId).split('::');
        const otherUserId = parts[0] || null;
        const jobIdRaw = parts[1] || 'general';
        const jobId = jobIdRaw === 'general' ? null : jobIdRaw;
        if (!otherUserId) continue;

        const filter = {
          $or: [
            { sender: userId, receiver: otherUserId },
            { sender: otherUserId, receiver: userId },
          ],
        };
        if (jobId) filter.job = jobId;

        const lastMsg = await withMessagePopulate(Message.find(filter)).sort({ createdAt: -1 }).limit(1);
        const msg = Array.isArray(lastMsg) && lastMsg[0] ? lastMsg[0] : null;
        const senderId = toIdString(msg?.sender);
        const counterparty = msg ? (senderId === String(otherUserId) ? msg.sender : msg.receiver) : null;
        results.push({
          conversationId: convId,
          otherUserId,
          otherUserName: getDisplayName(counterparty),
          jobId: jobId || null,
          jobTitle: msg?.job?.title || null,
          lastMessage: msg?.content || '',
          lastMessageAt: msg?.createdAt || null,
        });
      }

      return sendSuccess(res, 200, 'Archived conversations retrieved', results, { archived: results });
    } catch (error) {
      return sendError(res, 500, 'Server error', { error: error.message });
    }
  },

  // Compatibility endpoint: remove a conversation from the current user's inbox only.
  deleteConversationForBoth: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { otherUserId, jobId } = req.body;
      if (!userId) return sendError(res, 401, 'Authentication required.');
      if (!otherUserId || !isValidObjectId(otherUserId)) return sendError(res, 400, 'A valid otherUserId is required');
      const normalizedJobId = normalizeOptionalJobId(jobId);
      if (normalizedJobId && !isValidObjectId(normalizedJobId)) return sendError(res, 400, 'A valid jobId is required');
      const convId = `${otherUserId}::${normalizedJobId || 'general'}`;
      await User.updateOne({ _id: userId }, { $addToSet: { archivedConversations: convId } });
      return sendSuccess(
        res,
        200,
        'Conversation removed from your inbox',
        { conversationId: convId, removal: 'local' },
        { conversationId: convId, removal: 'local', deprecatedEndpoint: true }
      );
    } catch (error) {
      return sendError(res, 500, 'Server error', { error: error.message });
    }
  },
  getConversationWithUser,
};

export default MessageController;
