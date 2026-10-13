import Message from '../models/Message.js';
import User from '../models/User.js';
import ModerationReport from '../models/ModerationReport.js';
import { resolvePublicId } from '../lib/publicId.js';
import { isValidObjectId } from '../lib/messageSecurity.js';
import { sendError, sendSuccess } from '../lib/apiResponse.js';

const REASONS = {
  abuse: 'Abusive language or harassment',
  scam: 'Suspected scam or fraud',
  threats: 'Threats or unsafe behavior',
  other: 'Other messaging concern',
};

/** POST /messages/report — only a participant may report their visible chat. */
export async function reportConversation(req, res) {
  const reporterId = req.user?.id || req.user?._id || req.user?.userId;
  if (!reporterId) return sendError(res, 401, 'Authentication required.');
  const { otherUserId: target, jobId, category, details = '' } = req.body || {};
  const targetId = resolvePublicId(target);
  const conversationJob = jobId ? resolvePublicId(jobId) : null;
  if (!targetId || !isValidObjectId(targetId) || (jobId && !isValidObjectId(conversationJob))) {
    return sendError(res, 400, 'A valid conversation is required.');
  }
  if (String(targetId) === String(reporterId)) return sendError(res, 400, 'You cannot report yourself.');
  if (typeof category !== 'string' || !Object.hasOwn(REASONS, category) || typeof details !== 'string' || details.trim().length > 1500) {
    return sendError(res, 400, 'Choose a report reason and use at most 1500 characters for details.');
  }

  const pendingFilter = { reportedBy: reporterId, targetId, conversationJob, source: 'message', status: 'pending' };
  const respond = (report, alreadyPending = false) => sendSuccess(
    res, alreadyPending ? 200 : 201,
    alreadyPending ? 'This conversation already has a report awaiting review.' : 'Report submitted for admin review.',
    { reportId: report._id, status: report.status, alreadyPending },
  );
  try {
    const targetUser = await User.findById(targetId).select('firstName lastName').lean();
    if (!targetUser) return sendError(res, 404, 'User not found.');
    const messages = await Message.find({
      $or: [{ sender: reporterId, receiver: targetId }, { sender: targetId, receiver: reporterId }],
      job: conversationJob,
      deletedFor: { $ne: reporterId },
    }).sort({ createdAt: -1, _id: -1 }).limit(20).select('_id sender content createdAt').lean();
    if (!messages.length) return sendError(res, 403, 'You can only report a conversation you participate in.');
    const existing = await ModerationReport.findOne(pendingFilter);
    if (existing) return respond(existing, true);

    const report = await ModerationReport.create({
      ...pendingFilter,
      targetType: 'user',
      targetName: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || 'User',
      category,
      reason: `${REASONS[category]}${details.trim() ? `: ${details.trim()}` : ''}`,
      evidence: messages.reverse().map((message) => ({
        messageId: message._id,
        author: String(message.sender) === String(targetId) ? 'reportedUser' : 'reporter',
        content: message.content,
        createdAt: message.createdAt,
      })),
    });
    return respond(report);
  } catch (error) {
    // The unique pending-report index also handles concurrent submissions.
    if (error?.code === 11000) {
      const existing = await ModerationReport.findOne(pendingFilter);
      if (existing) return respond(existing, true);
    }
    console.error('Report conversation error:', error);
    return sendError(res, 500, 'Unable to submit the report. Please try again.');
  }
}
