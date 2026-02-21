import { Server } from 'socket.io';
import { isAllowedOrigin } from './corsOrigins.js';

let io = null;
const userSocketMap = new Map(); // userId -> Set(socketId)

export function initSocket(httpServer, opts = {}) {
  if (io) return io;
  const { allowedOrigins = new Set(), ...socketOptions } = opts;
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin, allowedOrigins)) {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
    ...socketOptions,
  });

  io.on('connection', (socket) => {
    // Clients should emit 'register' with their userId after connecting
    socket.on('register', (userId) => {
      try {
        if (!userId) return;
        const set = userSocketMap.get(userId) || new Set();
        set.add(socket.id);
        userSocketMap.set(userId, set);
      } catch (e) {
        // swallow
      }
    });

    socket.on('disconnect', () => {
      // remove socket id from all entries
      for (const [userId, set] of userSocketMap.entries()) {
        if (set.has(socket.id)) {
          set.delete(socket.id);
          if (set.size === 0) userSocketMap.delete(userId);
          else userSocketMap.set(userId, set);
        }
      }
    });
  });

  return io;
}

export function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  const sockets = userSocketMap.get(String(userId));
  if (!sockets) return;
  for (const sid of sockets) {
    io.to(sid).emit(event, payload);
  }
}

export function getIoInstance() {
  return io;
}
