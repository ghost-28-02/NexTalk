const { Server } = require('socket.io');
const { socketAuth } = require('./socket.auth');
const { registerPresenceHandler } = require('./handlers/presence.handler');
const { registerChatHandler } = require('./handlers/chat.handler');
const { registerNotificationHandler } = require('./handlers/notification.handler');
const { SYSTEM_EVENTS } = require('../shared/constants/events');
const { logger } = require('../shared/utils/logger');

let ioInstance = null;

/**
 * Initializes Socket.IO on the HTTP server.
 *
 * Personal rooms:
 *   Every socket joins `user:{userId}` on connect.
 *   This allows targeted server→client delivery (notifications, call signals)
 *   using io.to(`user:${userId}`) instead of iterating socket IDs.
 *   Works correctly for multi-device (one user, many sockets) because
 *   Socket.IO rooms are a set — all sockets in the room receive the emit.
 *
 * Single-server mode (current): uses in-memory adapter (default Socket.IO behaviour).
 *
 * FUTURE [Redis multi-instance]:
 *   const { createAdapter } = require('@socket.io/redis-adapter');
 *   io.adapter(createAdapter(pubClient, subClient));
 *   — Add this after `const io = new Server(...)` and before `io.use(socketAuth)`.
 *   No handler code changes required — room-based delivery works across instances.
 */
function initSocketManager(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    // Compress payloads > 1KB — important for message history bursts
    perMessageDeflate: {
      threshold: 1024,
    },
  });

  // FUTURE [Redis]: io.adapter(createAdapter(pubClient, subClient)); — place here

  // Authentication middleware — all sockets must pass before 'connection' fires.
  // On failure, Socket.IO emits 'connect_error' to the client with err.data.code.
  io.use(socketAuth);

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();

    logger.info(`[Socket] Connected: ${socket.user.username} (${socket.id})`);

    // ── Personal room ────────────────────────────────────────────────────────
    // Every socket joins a personal room keyed by userId.
    // Enables targeted server→client delivery:
    //   io.to(`user:${userId}`).emit(event, data)
    // All devices for the same user share this room — multi-device safe.
    socket.join(`user:${userId}`);

    // ── Domain handlers ──────────────────────────────────────────────────────
    // Each handler owns its own event subscriptions.
    registerPresenceHandler(io, socket);
    registerChatHandler(io, socket);
    registerNotificationHandler(io, socket);

    // ── Health check ping/pong ───────────────────────────────────────────────
    socket.on(SYSTEM_EVENTS.PING, () => {
      socket.emit(SYSTEM_EVENTS.PONG, { timestamp: Date.now() });
    });

    // ── Error logging ────────────────────────────────────────────────────────
    socket.on('error', (err) => {
      logger.error('[Socket] Socket error', {
        userId: socket.user?._id,
        err: err.message,
        code: err.data?.code,
      });
    });
  });

  ioInstance = io;
  logger.info('[Socket] Socket.IO initialized');
  return io;
}

/**
 * Returns the initialized io instance for use outside socket handlers
 * (e.g., services pushing a notification after an HTTP request completes).
 *
 * Usage:
 *   const { getIO } = require('./socket.manager');
 *   getIO().to(`user:${userId}`).emit('notification:new', notification);
 */
function getIO() {
  if (!ioInstance) throw new Error('Socket.IO not initialized. Call initSocketManager first.');
  return ioInstance;
}

module.exports = { initSocketManager, getIO };
