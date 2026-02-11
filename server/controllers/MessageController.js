import Message from '../models/Message.js';
import User from '../models/User.js';

const normalizeId = (value) => {
  if (!value) return value;
  if (typeof value === 'object' && value._id) return value._id.toString();
  if (typeof value === 'string') return value;
  if (typeof value.toString === 'function') return value.toString();
  return value;
};

const formatMessage = (message) => {
  const raw = message?.toObject ? message.toObject() : message;
  const senderName = raw?.sender?.firstName
    ? `${raw.sender.firstName} ${raw.sender.lastName || ''}`.trim()
    : undefined;
  const receiverName = raw?.receiver?.firstName
    ? `${raw.receiver.firstName} ${raw.receiver.lastName || ''}`.trim()
    : undefined;

  return {
    ...raw,
    sender: normalizeId(raw?.sender),
    receiver: normalizeId(raw?.receiver),
    senderName,
    receiverName,
  };
};

const getConversationWithUser = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    const { otherUserId } = req.params;
    if (!otherUserId) return res.status(400).json({ message: 'otherUserId required' });
    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId }
      ]
    })
      .populate('sender', 'firstName lastName')
      .populate('receiver', 'firstName lastName')
      .sort({ createdAt: 1 });
    res.json({ messages: messages.map(formatMessage) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const MessageController = {
  // Send a message from employer to worker or vice versa
  sendMessage: async (req, res) => {
    try {
      const { receiverId, content, jobId } = req.body;
      const senderId = req.user?.id || req.user?.userId;
      if (!senderId) {
        return res.status(401).json({ message: 'Authentication required.' });
      }
      if (!receiverId || !content) {
        return res.status(400).json({ message: 'Receiver and content are required.' });
      }
      const message = await Message.create({
        sender: senderId,
        receiver: receiverId,
        job: jobId,
        content,
      });
      const populated = await message.populate('sender', 'firstName lastName').populate('receiver', 'firstName lastName');
      res.status(201).json({ message: 'Message sent', data: formatMessage(populated) });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Get all conversations for the logged-in user
  getConversations: async (req, res) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required.' });
      }
      // Find all users this user has messaged or received messages from
      const messages = await Message.find({ $or: [ { sender: userId }, { receiver: userId } ] })
        .populate('sender', 'firstName lastName')
        .populate('receiver', 'firstName lastName')
        .sort({ createdAt: -1 });
      const formattedMessages = messages.map(formatMessage);
      // Group by other user
      const conversations = {};
      formattedMessages.forEach(msg => {
        const isSender = msg.sender === userId;
        const otherUser = isSender ? msg.receiver : msg.sender;
        const convoMessage = {
          ...msg,
          senderName: isSender ? undefined : msg.senderName,
          receiverName: isSender ? msg.receiverName : undefined,
        };
        if (!conversations[otherUser]) conversations[otherUser] = [];
        conversations[otherUser].push(convoMessage);
      });
      res.json({ conversations });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Get messages between two users (optionally for a job)
  getMessages: async (req, res) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required.' });
      }
      const { otherUserId, jobId } = req.query;
      if (!otherUserId) return res.status(400).json({ message: 'otherUserId required' });
      const filter = {
        $or: [
          { sender: userId, receiver: otherUserId },
          { sender: otherUserId, receiver: userId },
        ],
      };
      if (jobId) filter.job = jobId;
      const messages = await Message.find(filter)
        .populate('sender', 'firstName lastName')
        .populate('receiver', 'firstName lastName')
        .sort({ createdAt: 1 });
      res.json({ messages: messages.map(formatMessage) });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Mark messages as read
  markAsRead: async (req, res) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required.' });
      }
      const { otherUserId, jobId } = req.body;
      if (!otherUserId) return res.status(400).json({ message: 'otherUserId required' });
      const filter = {
        sender: otherUserId,
        receiver: userId,
        read: false,
      };
      if (jobId) filter.job = jobId;
      await Message.updateMany(filter, { $set: { read: true } });
      res.json({ message: 'Messages marked as read' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },
  getConversationWithUser,
};

export default MessageController;
