import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { isAllowedOrigin } from './corsOrigins.js';
import { getJwtSecret } from './jwtSecret.js';

let io = null;
const userSocketMap = new Map(); // userId -> Set(socketId)

function normalizeUserId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function addSocketForUser(userId, socketId) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId || !socketId) return;
  const set = userSocketMap.get(normalizedUserId) || new Set();
  set.add(socketId);
  userSocketMap.set(normalizedUserId, set);
}

function removeSocket(socketId) {
  for (const [userId, set] of userSocketMap.entries()) {
    if (set.has(socketId)) {
      set.delete(socketId);
      if (set.size === 0) userSocketMap.delete(userId);
      else userSocketMap.set(userId, set);
    }
  }
}

function extractSocketToken(socket) {
  const authToken = socket.handshake?.auth?.token;
  if (authToken) return String(authToken).replace(/^Bearer\s+/i, '').trim();

  const authHeader = socket.handshake?.headers?.authorization;
  if (authHeader && typeof authHeader === 'string') {
    return authHeader.replace(/^Bearer\s+/i, '').trim();
  }

  const queryToken = socket.handshake?.query?.token;
  if (queryToken) return String(queryToken).replace(/^Bearer\s+/i, '').trim();

  const cookieHeader = socket.handshake?.headers?.cookie;
  if (cookieHeader && typeof cookieHeader === 'string') {
    const tokenCookie = cookieHeader
      .split(';')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith('token='));
    if (tokenCookie) {
      return decodeURIComponent(tokenCookie.substring('token='.length));
    }
  }

  return '';
}

export function initSocket(httpServer, opts = {}) {
  if (io) return io;
  const { allowedOrigins = new Set(), ...socketOptions } = opts;
  const isProduction = process.env.NODE_ENV === 'production';
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // React Native / Expo development clients can send varying origins.
        // Keep production strict, but allow local development clients through.
        if (!isProduction || isAllowedOrigin(origin, allowedOrigins)) {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
    ...socketOptions,
  });

  io.use((socket, next) => {
    try {
      const token = extractSocketToken(socket);
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, getJwtSecret());
      const tokenUserId = normalizeUserId(decoded?.userId || decoded?.id || decoded?._id);
      if (!tokenUserId) {
        return next(new Error('Invalid token payload'));
      }

      socket.data.userId = tokenUserId;
      return next();
    } catch (error) {
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const authenticatedUserId = normalizeUserId(socket.data?.userId);
    addSocketForUser(authenticatedUserId, socket.id);

    // Keep backwards compatibility with clients that still emit register,
    // but never trust a claimed user ID that differs from authenticated token.
    socket.on('register', (claimedUserId) => {
      const normalizedClaimed = normalizeUserId(claimedUserId);
      if (!normalizedClaimed) return;
      if (normalizedClaimed !== authenticatedUserId) {
        socket.disconnect(true);
        return;
      }
      addSocketForUser(authenticatedUserId, socket.id);
    });

    socket.on('disconnect', () => {
      removeSocket(socket.id);
    });
  });

  return io;
}

export function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  const sockets = userSocketMap.get(normalizeUserId(userId));
  if (!sockets) return;
  for (const sid of sockets) {
    io.to(sid).emit(event, payload);
  }
}

export function getIoInstance() {
  return io;
}
