import Message from '../models/Message.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import { emitToUser } from '../lib/socket.js';
import { createNotification } from '../lib/notificationService.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';
import { isValidObjectId, validateMessageContent } from '../lib/messageSecurity.js';
import { isStaffRole } from '../lib/staffProfileVisibility.js';
import {
  buildConversationKey,
  buildInquiryMessage,
  describeInquiryConversation,
  evaluateJobInquiry,
  isJobConversationParticipant,
  normalizeOptionalJobId,
  parseConversationKey,
  toIdString,
} from '../lib/jobInquiry.js';

const getAuthUserId = (req) => req.user?.id || req.user?._id || req.user?.userId || null;


const getDisplayName = (user) => {
  if (!user || typeof user !== 'object') return 'User';
  const firstName = typeof user.firstName === 'string' ? user.firstName.trim() : '';
  const lastName = typeof user.lastName === 'string' ? user.lastName.trim() : '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || 'User';
};

const EDIT_WINDOW_MS = 30 * 1000;


const withMessagePopulate = (query) =>
  query
    .populate('sender', 'firstName lastName role')
    .populate('receiver', 'firstName lastName role')
    .populate('job', 'title')
    .populate('attachment.settlementRequest', 'status expiresAt settledAt')
    .populate('attachment.jobOffer', 'status amount acceptedAt resolvedAt');

/**
 * Loads the job for a job-scoped message and confirms the thread belongs to the
 * employer who posted it. This prevents job inquiries from being attached to
 * unrelated conversations such as the Admin/Support channel.
 */
const resolveJobContext = async ({ jobId, senderId, receiverId }) => {
  const job = await Job.findById(jobId).select('_id title jobPoster').lean();
  if (!job) {
    return { error: { status: 404, message: 'Job not found.' } };
  }
  if (!isJobConversationParticipant({ job, senderId, receiverId })) {
    return {
      error: {
        status: 403,
        message: 'Job messages must be exchanged with the employer who posted the job.',
      },
    };
  }
  return { error: null, job };
};

const deliverMessage = async ({ senderId, receiverId, content, jobId, clientMessageId, receiverRole }) => {
  const normalizedJobId = normalizeOptionalJobId(jobId);
  let message;
  try {
    message = await Message.create({
      sender: senderId,
      receiver: receiverId,
      job: normalizedJobId || undefined,
      content,
      clientMessageId: clientMessageId || undefined,
    });
  } catch (error) {
    if (error?.code !== 11000 || !clientMessageId) throw error;
    const existing = await Message.findOne({ sender: senderId, clientMessageId });
    if (!existing) throw error;
    const hydratedExisting = await withMessagePopulate(Message.findById(existing._id));
    return { payload: hydratedExisting || existing, deduplicated: true };
  }

  // Re-surface the thread for both sides so a new inquiry leaves the archive.
  await Promise.all([
    User.updateOne(
      { _id: senderId },
      { $pull: { archivedConversations: buildConversationKey(receiverId, normalizedJobId) } },
    ),
    User.updateOne(
      { _id: receiverId },
      { $pull: { archivedConversations: buildConversationKey(senderId, normalizedJobId) } },
    ),
  ]);

  const hydratedMessage = await withMessagePopulate(Message.findById(message._id));
  const payload = hydratedMessage || message;

  try {
    emitToUser(receiverId, 'new_message', payload);
    emitToUser(senderId, 'new_message_echo', payload);
  } catch (e) {
    // ignore emit errors
  }

  let audience = receiverRole === 'hire' ? 'employer' : receiverRole === 'work' ? 'worker' : 'shared';
  if (receiverRole === 'both' && normalizedJobId) {
    const job = await Job.findById(normalizedJobId).select('jobPoster').lean();
    audience = toIdString(job?.jobPoster) === toIdString(receiverId) ? 'employer' : 'worker';
  }

  try {
    await createNotification({
      userId: receiverId,
      audience,
      type: 'message',
      title: `New message from ${getDisplayName(payload.sender)}`,
      message: content,
      entityType: 'message',
      entityId: message._id,
      actor: senderId,
      metadata: { senderId: String(senderId), jobId: normalizedJobId ? String(normalizedJobId) : null },
      push: true,
      pushData: {
        type: 'message',
        entityType: 'message',
        entityId: String(message._id),
        senderId: String(senderId),
        jobId: normalizedJobId ? String(normalizedJobId) : null,
        audience,
      },
    });
  } catch (notificationError) {
    console.warn('Message notification delivery failed:', notificationError?.name || 'notification_error');
  }

  return { payload, deduplicated: false };
};

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

      const receiver = await User.findById(receiverId).select('blockedUsers role');
      if (!receiver) {
        return sendError(res, 404, 'Receiver not found.');
      }

      // If the receiver has blocked the sender, disallow sending
      const blocked = Array.isArray(receiver.blockedUsers) && receiver.blockedUsers.some((id) => String(id) === String(senderId));
      if (blocked) {
        return sendError(res, 403, 'You are blocked by this user.');
      }

      // Job-scoped threads must involve the job poster, never Admin/Support.
      if (normalizedJobId) {
        const { error: jobError } = await resolveJobContext({
          jobId: normalizedJobId,
          senderId,
          receiverId,
        });
        if (jobError) return sendError(res, jobError.status, jobError.message);
      }

      const { payload, deduplicated } = await deliverMessage({
        senderId,
        receiverId,
        content: trimmedContent,
        jobId: normalizedJobId,
        clientMessageId: normalizedClientMessageId,
        receiverRole: receiver.role,
      });

      if (deduplicated) {
        return sendSuccess(res, 200, 'Message already sent', payload, { data: payload, deduplicated: true });
      }
      return sendSuccess(res, 201, 'Message sent', payload, { data: payload });
    } catch (error) {
      return sendError(res, 500, 'Server error', { error: error.message });
    }
  },

  /**
   * Opens (and optionally seeds) a job inquiry thread between the requesting
   * worker and the employer who posted the job. The employer is resolved from the
   * job document so inquiries never fall back to the Admin/Support channel.
   */
  startJobInquiry: async (req, res) => {
    try {
      const senderId = getAuthUserId(req);
      const jobId = normalizeOptionalJobId(req.params?.jobId || req.body?.jobId);
      if (!senderId) return sendError(res, 401, 'Authentication required.');
      if (!jobId || !isValidObjectId(jobId)) return sendError(res, 400, 'A valid jobId is required.');

      const job = await Job.findById(jobId)
        .select('_id title jobPoster')
        .populate('jobPoster', '_id firstName lastName companyName role blockedUsers')
        .lean();

      const inquiry = evaluateJobInquiry({ job, workerId: senderId });
      if (inquiry.error) return sendError(res, inquiry.error.status, inquiry.error.message);

      const { employerId, employerName, jobTitle } = inquiry;
      const employer = job.jobPoster && typeof job.jobPoster === 'object'
        ? job.jobPoster
        : await User.findById(employerId).select('role blockedUsers').lean();
      if (!employer) return sendError(res, 404, 'Employer account not found.');

      const blocked = Array.isArray(employer.blockedUsers)
        && employer.blockedUsers.some((id) => String(id) === String(senderId));
      if (blocked) return sendError(res, 403, 'You are blocked by this employer.');

      const conversation = describeInquiryConversation({ employerId, employerName, jobId, jobTitle });
      const { content: requestedContent } = validateMessageContent(req.body?.content);
      const shouldSeed = req.body?.sendInitialMessage !== false;

      const existing = await Message.countDocuments({
        job: jobId,
        $or: [
          { sender: senderId, receiver: employerId },
          { sender: employerId, receiver: senderId },
        ],
      });

      let payload = null;
      if (shouldSeed && (requestedContent || existing === 0)) {
        const content = requestedContent || buildInquiryMessage({ jobTitle, employerName });
        const delivery = await deliverMessage({
          senderId,
          receiverId: employerId,
          content,
          jobId,
          clientMessageId: typeof req.body?.clientMessageId === 'string'
            ? req.body.clientMessageId.trim().slice(0, 100)
            : '',
          receiverRole: employer.role,
        });
        payload = delivery.payload;
      }

      const result = { conversation, message: payload };
      return sendSuccess(res, payload ? 201 : 200, 'Job inquiry ready', result, {
        ...conversation,
        data: result,
        message: payload,
      });
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
        const conversationId = buildConversationKey(otherUserId, jobId);
        if (archivedSet.has(conversationId)) return;

        if (!conversationMap.has(conversationId)) {
          conversationMap.set(conversationId, {
            conversationId,
            otherUserId,
            otherUserName: getDisplayName(otherUser),
            // Admin/Support has no public profile; clients must not link to one.
            otherUserIsStaff: isStaffRole(otherUser?.role),
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
      const convId = buildConversationKey(otherUserId, normalizedJobId);
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
        const { otherUserId, jobId } = parseConversationKey(convId);
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
          otherUserIsStaff: isStaffRole(counterparty?.role),
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
      const convId = buildConversationKey(otherUserId, normalizedJobId);
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
