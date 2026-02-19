import Message from '../models/Message.js';
import User from '../models/User.js';
import { emitToUser } from '../lib/socket.js';

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

const withMessagePopulate = (query) =>
  query
    .populate('sender', 'firstName lastName')
    .populate('receiver', 'firstName lastName')
    .populate('job', 'title');

const getConversationWithUser = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { otherUserId } = req.params;
    const jobId = normalizeOptionalJobId(req.query?.jobId);
    if (!userId) return res.status(401).json({ message: 'Authentication required.' });
    if (!otherUserId) return res.status(400).json({ message: 'otherUserId required' });

    const filter = {
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId },
      ],
    };
    if (jobId) filter.job = jobId;

    const messages = await withMessagePopulate(Message.find(filter)).sort({ createdAt: 1 });
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const MessageController = {
  // Send a message from employer to worker or vice versa
  sendMessage: async (req, res) => {
    try {
      const { receiverId, content, jobId } = req.body;
      const senderId = getAuthUserId(req);
      const trimmedContent = typeof content === 'string' ? content.trim() : '';
      const normalizedJobId = normalizeOptionalJobId(jobId);

      if (!senderId) {
        return res.status(401).json({ message: 'Authentication required.' });
      }
      if (!receiverId || !trimmedContent) {
        return res.status(400).json({ message: 'Receiver and content are required.' });
      }

      const receiver = await User.findById(receiverId).select('blockedUsers');
      if (!receiver) {
        return res.status(404).json({ message: 'Receiver not found.' });
      }

      // If the receiver has blocked the sender, disallow sending
      const blocked = Array.isArray(receiver.blockedUsers) && receiver.blockedUsers.some((id) => String(id) === String(senderId));
      if (blocked) {
        return res.status(403).json({ message: 'You are blocked by this user.' });
      }

      const message = await Message.create({
        sender: senderId,
        receiver: receiverId,
        job: normalizedJobId || undefined,
        content: trimmedContent,
      });

      const hydratedMessage = await withMessagePopulate(Message.findById(message._id));
      // Emit real-time event to the receiver (and optionally to the sender)
      try {
        const payload = hydratedMessage || message;
        emitToUser(receiverId, 'new_message', payload);
        emitToUser(senderId, 'new_message_echo', payload);
      } catch (e) {
        // ignore emit errors
      }

      res.status(201).json({ message: 'Message sent', data: hydratedMessage || message });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Get all conversations for the logged-in user
  getConversations: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) return res.status(401).json({ message: 'Authentication required.' });

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
        if (conversationMap.has(conversationId)) return;

        conversationMap.set(conversationId, {
          conversationId,
          otherUserId,
          otherUserName: getDisplayName(otherUser),
          jobId,
          jobTitle: msg.job?.title || null,
          lastMessage: msg.content || '',
          lastMessageAt: msg.createdAt,
        });
      });

      const conversations = Array.from(conversationMap.values());
      res.json({ conversations });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Get messages between two users (optionally for a job)
  getMessages: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { otherUserId, jobId } = req.query;
      const normalizedJobId = normalizeOptionalJobId(jobId);
      if (!userId) return res.status(401).json({ message: 'Authentication required.' });
      if (!otherUserId) return res.status(400).json({ message: 'otherUserId required' });
      const filter = {
        $or: [
          { sender: userId, receiver: otherUserId },
          { sender: otherUserId, receiver: userId },
        ],
      };
      if (normalizedJobId) filter.job = normalizedJobId;
      const messages = await withMessagePopulate(Message.find(filter)).sort({ createdAt: 1 });
      res.json({ messages });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Mark messages as read/unread
  markAsRead: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { otherUserId, jobId, read } = req.body;
      const normalizedJobId = normalizeOptionalJobId(jobId);
      if (!userId) return res.status(401).json({ message: 'Authentication required.' });
      if (!otherUserId) return res.status(400).json({ message: 'otherUserId required' });
      const filter = {
        sender: otherUserId,
        receiver: userId,
      };
      if (normalizedJobId) filter.job = normalizedJobId;
      const setRead = read === false ? false : true; // default to true
      await Message.updateMany(filter, { $set: { read: setRead } });
      res.json({ message: setRead ? 'Messages marked as read' : 'Messages marked as unread' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },
  // Block another user
  blockUser: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { otherUserId } = req.body;
      if (!userId) return res.status(401).json({ message: 'Authentication required.' });
      if (!otherUserId) return res.status(400).json({ message: 'otherUserId required' });
      await User.updateOne({ _id: userId }, { $addToSet: { blockedUsers: otherUserId } });
      // notify the blocked user via socket that they were blocked by userId
      try {
        emitToUser(otherUserId, 'user_blocked', { blockerId: userId });
      } catch (e) {}
      res.json({ message: 'User blocked' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  unblockUser: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { otherUserId } = req.body;
      if (!userId) return res.status(401).json({ message: 'Authentication required.' });
      if (!otherUserId) return res.status(400).json({ message: 'otherUserId required' });
      await User.updateOne({ _id: userId }, { $pull: { blockedUsers: otherUserId } });
      try {
        emitToUser(otherUserId, 'user_unblocked', { unblockedBy: userId });
      } catch (e) {}
      res.json({ message: 'User unblocked' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Archive or unarchive a conversation for the current user
  archiveConversation: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { otherUserId, jobId, archive } = req.body;
      if (!userId) return res.status(401).json({ message: 'Authentication required.' });
      if (!otherUserId) return res.status(400).json({ message: 'otherUserId required' });
      const convId = `${otherUserId}::${jobId || 'general'}`;
      if (archive) {
        await User.updateOne({ _id: userId }, { $addToSet: { archivedConversations: convId } });
        return res.json({ message: 'Conversation archived' });
      }
      await User.updateOne({ _id: userId }, { $pull: { archivedConversations: convId } });
      res.json({ message: 'Conversation unarchived' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Get list of users current user has blocked
  getBlockedUsers: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) return res.status(401).json({ message: 'Authentication required.' });
      const user = await User.findById(userId).populate('blockedUsers', 'firstName lastName email');
      const blocked = (user?.blockedUsers || []).map((u) => ({ id: u._id, firstName: u.firstName, lastName: u.lastName, email: u.email }));
      res.json({ blocked });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },
  // Get archived conversations for the current user
  getArchivedConversations: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) return res.status(401).json({ message: 'Authentication required.' });
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
        results.push({
          conversationId: convId,
          otherUserId,
          otherUserName: getDisplayName(msg ? (msg.sender && msg.sender._id === otherUserId ? msg.sender : msg.receiver) : null),
          jobId: jobId || null,
          jobTitle: msg?.job?.title || null,
          lastMessage: msg?.content || '',
          lastMessageAt: msg?.createdAt || null,
        });
      }

      res.json({ archived: results });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Delete conversation for both users (permanently remove messages between the two users for job)
  deleteConversationForBoth: async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      const { otherUserId, jobId } = req.body;
      if (!userId) return res.status(401).json({ message: 'Authentication required.' });
      if (!otherUserId) return res.status(400).json({ message: 'otherUserId required' });
      const normalizedJobId = normalizeOptionalJobId(jobId);
      const filter = {
        $or: [
          { sender: userId, receiver: otherUserId },
          { sender: otherUserId, receiver: userId },
        ],
      };
      if (normalizedJobId) filter.job = normalizedJobId;
      await Message.deleteMany(filter);
      // remove archived keys from both users
      const convId = `${otherUserId}::${normalizedJobId || 'general'}`;
      await User.updateOne({ _id: userId }, { $pull: { archivedConversations: convId } });
      const convId2 = `${userId}::${normalizedJobId || 'general'}`;
      await User.updateOne({ _id: otherUserId }, { $pull: { archivedConversations: convId2 } });
      res.json({ message: 'Conversation deleted for both users' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },
  getConversationWithUser,
};

export default MessageController;
