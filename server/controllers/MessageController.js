import Message from '../models/Message.js';
import User from '../models/User.js';

const getConversationWithUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { otherUserId } = req.params;
    if (!otherUserId) return res.status(400).json({ message: 'otherUserId required' });
    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId }
      ]
    }).sort({ createdAt: 1 });
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
      const senderId = req.user._id;
      if (!receiverId || !content) {
        return res.status(400).json({ message: 'Receiver and content are required.' });
      }
      const message = await Message.create({
        sender: senderId,
        receiver: receiverId,
        job: jobId,
        content,
      });
      res.status(201).json({ message: 'Message sent', data: message });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Get all conversations for the logged-in user
  getConversations: async (req, res) => {
    try {
      const userId = req.user._id;
      // Find all users this user has messaged or received messages from
      const messages = await Message.find({ $or: [ { sender: userId }, { receiver: userId } ] })
        .sort({ createdAt: -1 });
      // Group by other user
      const conversations = {};
      messages.forEach(msg => {
        const otherUser = msg.sender.equals(userId) ? msg.receiver : msg.sender;
        if (!conversations[otherUser]) conversations[otherUser] = [];
        conversations[otherUser].push(msg);
      });
      res.json({ conversations });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Get messages between two users (optionally for a job)
  getMessages: async (req, res) => {
    try {
      const userId = req.user._id;
      const { otherUserId, jobId } = req.query;
      if (!otherUserId) return res.status(400).json({ message: 'otherUserId required' });
      const filter = {
        $or: [
          { sender: userId, receiver: otherUserId },
          { sender: otherUserId, receiver: userId },
        ],
      };
      if (jobId) filter.job = jobId;
      const messages = await Message.find(filter).sort({ createdAt: 1 });
      res.json({ messages });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  },

  // Mark messages as read
  markAsRead: async (req, res) => {
    try {
      const userId = req.user._id;
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
