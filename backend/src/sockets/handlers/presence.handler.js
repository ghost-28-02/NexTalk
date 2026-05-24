/**
 * Presence handler — manages online/offline state for connected sockets.
 *
 * Architecture notes:
 * ─── Storage ─────────────────────────────────────────────────────────────────
 *   presenceAdapter (memory.adapter.js) tracks who is online in this process.
 *   SCALE-OUT: swap to redis.adapter.js — no changes to this file needed.
 *
 * ─── DB writes ───────────────────────────────────────────────────────────────
 *   Writing to MongoDB on every connect/disconnect is expensive on mobile
 *   (users reconnect every few seconds on flaky connections).
 *   Solution: 3-second debounce on the "offline" DB write + broadcast.
 *   If the user reconnects within the window, the pending write is cancelled.
 *   "Online" writes are immediate — users want to appear online instantly.
 *
 * ─── Broadcast scope ─────────────────────────────────────────────────────────
 *   Current: socket.broadcast.emit → ALL connected users.
 *   FUTURE [contact-scoped]: replace broadcast with targeted room emit:
 *     1. On connect, join a personal room: socket.join(`user:${userId}`)
 *     2. Fetch contact IDs from contactRepository.getContactIds(userId)
 *     3. Emit only to those rooms: io.to(`user:${contactId}`).emit(...)
 *   This swap can be done without changing the event names or client code.
 *   See FUTURE [Contact-Scoped Broadcast] comments below.
 */

const presenceAdapter = require('../adapters/memory.adapter');
// FUTURE [Redis]: swap above import for redis.adapter.js — no changes below needed
const { userRepository } = require('../../database/repositories/user.repository');
const { PRESENCE_EVENTS } = require('../../shared/constants/events');
const { USER_STATUS } = require('../../shared/constants/status');
const { logger } = require('../../shared/utils/logger');

// ─── Debounce registry ────────────────────────────────────────────────────────
// Keyed by userId (string). Holds setTimeout handles for pending "gone offline"
// DB writes. Cleared on reconnect to prevent a mobile blip from writing OFFLINE.
const disconnectTimers = new Map();

const OFFLINE_DEBOUNCE_MS = 3000; // 3-second grace window

// ─── Handler ─────────────────────────────────────────────────────────────────

function registerPresenceHandler(io, socket) {
  const userId = socket.user._id.toString();

  // ── Connect ────────────────────────────────────────────────────────────────

  // If user reconnected within the debounce window, cancel the pending
  // "gone offline" write — they never really left.
  if (disconnectTimers.has(userId)) {
    clearTimeout(disconnectTimers.get(userId));
    disconnectTimers.delete(userId);
    logger.debug(`[Presence] ${socket.user.username} reconnected before debounce fired`);
  }

  presenceAdapter.addUserSocket(userId, socket.id);
  presenceAdapter.setUserData(userId, { status: USER_STATUS.ONLINE });

  // Write online status to DB immediately — no debounce for going online
  userRepository.updateStatus(userId, USER_STATUS.ONLINE).catch((err) => {
    logger.warn('[Presence] Failed to persist online status', { userId, err: err.message });
  });

  // FUTURE [Contact-Scoped Broadcast]:
  //   const contactIds = await contactRepository.getContactIds(userId);
  //   socket.join(`user:${userId}`);
  //   for (const cId of contactIds) io.to(`user:${cId}`).emit(PRESENCE_EVENTS.USER_ONLINE, payload);
  socket.broadcast.emit(PRESENCE_EVENTS.USER_ONLINE, { userId, status: USER_STATUS.ONLINE });

  logger.debug(`[Presence] ${socket.user.username} connected (${socket.id})`);

  // ── Status change ──────────────────────────────────────────────────────────

  socket.on(PRESENCE_EVENTS.STATUS_CHANGE, ({ status }) => {
    if (!Object.values(USER_STATUS).includes(status)) return;

    presenceAdapter.setUserData(userId, { status });

    // DB write is also debounced for manual status changes — but a shorter window
    // since these are intentional user actions rather than network blips.
    userRepository.updateStatus(userId, status).catch((err) => {
      logger.warn('[Presence] Failed to persist status change', { userId, err: err.message });
    });

    // FUTURE [Contact-Scoped Broadcast]: replace with targeted room emits (see above)
    socket.broadcast.emit(PRESENCE_EVENTS.STATUS_CHANGE, { userId, status });
  });

  // ── Bulk presence query ────────────────────────────────────────────────────
  // Client sends a list of userIds and gets back a map of { userId: status }.
  // Used when loading a chat list or contact page to populate status indicators.

  socket.on(PRESENCE_EVENTS.BULK_STATUS, ({ userIds }, callback) => {
    if (typeof callback !== 'function') return;
    if (!Array.isArray(userIds)) return callback({ statuses: {} });

    const statuses = {};
    for (const uid of userIds) {
      statuses[uid] = presenceAdapter.isUserOnline(uid)
        ? USER_STATUS.ONLINE
        : USER_STATUS.OFFLINE;
    }
    callback({ statuses });
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────

  socket.on('disconnect', (reason) => {
    const isFullyOffline = presenceAdapter.removeUserSocket(userId, socket.id);

    if (!isFullyOffline) {
      // User still has other active sockets (e.g. multiple tabs) — nothing to do
      return;
    }

    logger.debug(`[Presence] ${socket.user.username} last socket closed (${reason})`);

    // Debounce the "gone offline" write to handle mobile reconnects gracefully.
    // If the user reconnects within OFFLINE_DEBOUNCE_MS, the timer is cleared above.
    const timer = setTimeout(() => {
      disconnectTimers.delete(userId);

      userRepository
        .updateStatus(userId, USER_STATUS.OFFLINE)
        .catch((err) => {
          logger.warn('[Presence] Failed to persist offline status', { userId, err: err.message });
        });

      // FUTURE [Contact-Scoped Broadcast]: replace with targeted room emits (see above)
      socket.broadcast.emit(PRESENCE_EVENTS.USER_OFFLINE, {
        userId,
        status: USER_STATUS.OFFLINE,
        lastSeenAt: new Date(),
      });

      logger.debug(`[Presence] ${socket.user.username} marked offline after debounce`);
    }, OFFLINE_DEBOUNCE_MS);

    disconnectTimers.set(userId, timer);
  });
}

module.exports = { registerPresenceHandler };
