import crypto from 'crypto';
import Session from '../models/Session.js';
import User from '../models/User.js';
import { disconnectSession } from '../lib/socket.js';
import { createAccessToken, cookieSecurityOptions, SESSION_TTL_MS } from '../lib/authSession.js';

export const SELF_SERVICE_ROLES = new Set(['hire', 'work', 'both']);

const refreshSession = async (req, res) => {
  try {
    const incoming = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!incoming) return res.status(400).json({ message: 'Refresh token required' });

    const incomingHash = crypto.createHash('sha256').update(incoming).digest('hex');
    const session = await Session.findOne({ refreshTokenHash: incomingHash });
    if (!session || !session.active) return res.status(401).json({ message: 'Invalid session' });
    if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
      session.active = false;
      session.endedAt = new Date();
      await session.save();
      return res.status(401).json({ message: 'Session expired' });
    }

    const user = await User.findById(session.user);
    if (!user) return res.status(401).json({ message: 'Invalid session user' });

    const newAccess = createAccessToken(user, session._id.toString());
    const newRefresh = crypto.randomBytes(64).toString('hex');
    const newHash = crypto.createHash('sha256').update(newRefresh).digest('hex');
    session.token = newAccess;
    session.refreshTokenHash = newHash;
    const sessionStart = session.createdAt ? new Date(session.createdAt).getTime() : Date.now();
    session.expiresAt = new Date(sessionStart + SESSION_TTL_MS);
    await session.save();

    res.cookie('refreshToken', newRefresh, {
      httpOnly: true,
      ...cookieSecurityOptions,
      expires: session.expiresAt,
    });
    res.cookie('sessionId', session._id.toString(), {
      httpOnly: true,
      ...cookieSecurityOptions,
      expires: session.expiresAt,
    });
    res.cookie('token', newAccess, {
      httpOnly: true,
      ...cookieSecurityOptions,
      expires: new Date(Date.now() + 15 * 60 * 1000),
    });

    return res.status(200).json({ token: newAccess });
  } catch (err) {
    console.error('Refresh error', err);
    return res.status(500).json({ message: 'Failed to refresh token' });
  }
};

const listSessions = async (req, res) => {
  try {
    const currentSessionId = req.user.sessionId || null;
    const now = new Date();

    await Session.deleteMany({
      user: req.user.id,
      $or: [
        { expiresAt: { $lt: now } },
        { active: false },
      ],
    });

    const sessions = await Session.find({
      user: req.user.id,
      active: true,
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .select('-refreshTokenHash -token');

    const sessionsWithCurrent = sessions.map((session) => ({
      ...session.toObject(),
      isCurrent: session._id.toString() === currentSessionId,
    }));

    return res.status(200).json({ sessions: sessionsWithCurrent, currentSessionId });
  } catch (err) {
    console.error('Sessions list error', err);
    return res.status(500).json({ message: 'Failed to list sessions' });
  }
};

const revokeSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.user.toString() !== String(req.user.id)) return res.status(403).json({ message: 'Not authorized' });

    if (req.user.sessionId && session._id.toString() === req.user.sessionId) {
      return res.status(400).json({ message: 'Cannot revoke current session. Use sign-out instead.' });
    }

    await Session.findByIdAndDelete(req.params.id);
    disconnectSession(req.params.id);
    return res.status(200).json({ message: 'Session revoked' });
  } catch (err) {
    console.error('Revoke session error', err);
    return res.status(500).json({ message: 'Failed to revoke session' });
  }
};

const revokeAllSessions = async (req, res) => {
  try {
    const sessionIds = await Session.find({ user: req.user.id }).distinct('_id');
    await Session.deleteMany({
      user: req.user.id,
      _id: { $ne: req.user.sessionId },
    });

    if (req.user.sessionId) {
      await Session.findByIdAndDelete(req.user.sessionId);
    }
    sessionIds.forEach((sessionId) => disconnectSession(sessionId));

    res.clearCookie('refreshToken', { ...cookieSecurityOptions, httpOnly: true });
    res.clearCookie('sessionId', { ...cookieSecurityOptions, httpOnly: true });
    res.clearCookie('csrfToken', { ...cookieSecurityOptions, httpOnly: false });
    res.clearCookie('token', { ...cookieSecurityOptions, httpOnly: true });
    return res.status(200).json({ message: 'All sessions revoked' });
  } catch (err) {
    console.error('Revoke all sessions error', err);
    return res.status(500).json({ message: 'Failed to revoke sessions' });
  }
};

const cleanupSessions = async (req, res) => {
  try {
    const now = new Date();
    const result = await Session.deleteMany({
      user: req.user.id,
      $or: [
        { active: false },
        { expiresAt: { $lt: now } },
      ],
    });
    return res.status(200).json({
      message: 'Inactive sessions cleaned up',
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error('Cleanup sessions error', err);
    return res.status(500).json({ message: 'Failed to cleanup sessions' });
  }
};

const adminListSessions = async (req, res) => {
  try {
    const role = req.user.role || '';
    if (role !== 'admin' && role !== 'superadmin') return res.status(403).json({ message: 'Admin access required' });
    const sessions = await Session.find({ user: req.params.userId }).select('-refreshTokenHash -token');
    return res.status(200).json({ sessions });
  } catch (err) {
    console.error('Admin sessions error', err);
    return res.status(500).json({ message: 'Failed to fetch sessions' });
  }
};

const logout = async (req, res) => {
  const sessionId = req.user?.sessionId || req.cookies?.sessionId || req.body?.sessionId;
  if (sessionId) {
    try {
      const session = await Session.findById(sessionId);
      if (session && session.user.toString() === String(req.user?.id)) {
        session.endedAt = new Date();
        session.active = false;
        await session.save();
        disconnectSession(sessionId);
      }
    } catch (err) {
      console.warn('Failed to update session on logout', err);
    }
  }

  res.clearCookie('refreshToken', { ...cookieSecurityOptions, httpOnly: true });
  res.clearCookie('sessionId', { ...cookieSecurityOptions, httpOnly: true });
  res.clearCookie('csrfToken', { ...cookieSecurityOptions, httpOnly: false });
  res.clearCookie('token', { ...cookieSecurityOptions, httpOnly: true });
  res.status(200).json({ message: 'Logout successful' });
};

export {
  refreshSession,
  listSessions,
  revokeSession,
  revokeAllSessions,
  cleanupSessions,
  adminListSessions,
  logout,
};
export default {
  refreshSession,
  listSessions,
  revokeSession,
  revokeAllSessions,
  cleanupSessions,
  adminListSessions,
  logout,
  SELF_SERVICE_ROLES,
};
