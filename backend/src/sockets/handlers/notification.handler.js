const { NOTIFICATION_EVENTS } = require('../../shared/constants/events');
const { logger } = require('../../shared/utils/logger');

/**
 * Notification handler.
 *
 * Delivery strategy: personal rooms.
 *   Each connected socket joins `user:{userId}` in socket.manager.js.
 *   Emitting to that room reaches ALL active sockets for the user
 *   (phone + desktop, multiple tabs) without iterating socket IDs.
 *
 * Server → Client: 'notification:new' — pushed when a new notification is
 *   created in the DB (contact request, message, etc.).
 *
 * Client → Server: 'notification:read' — client-side optimistic update trigger.
 *   The actual DB mark-as-read is handled by HTTP PATCH /notifications/:id/read.
 *
 * FUTURE [Redis Pub/Sub]:
 *   Replace getIO().to(`user:${userId}`) with:
 *     pub.publish('notification:deliver', JSON.stringify({ userId, notification }))
 *   Each server instance subscribes and emits to local sockets in the user's room.
 *   This ensures delivery works when the recipient is on a different instance.
 */

/**
 * Delivers a realtime notification to a specific user across all their active sockets.
 * Called internally by services (e.g., after a contact request is accepted).
 *
 * Requires the io instance — import getIO() at the call site:
 *   const { getIO } = require('../../sockets/socket.manager');
 *   const { deliverNotification } = require('../../sockets/handlers/notification.handler');
 *   deliverNotification(getIO(), userId, notification);
 *
 * @param {import('socket.io').Server} io
 * @param {string} userId
 * @param {object} notification
 */
function deliverNotification(io, userId, notification) {
  // Emit to the personal room — reaches all sockets for this user simultaneously
  io.to(`user:${userId}`).emit(NOTIFICATION_EVENTS.NEW, notification);
  logger.debug(`[Notification] Delivered to user:${userId}`);
}

function registerNotificationHandler(io, socket) {
  // Acknowledge the client optimistic read — actual DB update is via HTTP
  socket.on(NOTIFICATION_EVENTS.READ, ({ notificationId }) => {
    logger.debug(`[Notification] ${socket.user._id} ack read ${notificationId}`);
  });
}

module.exports = { deliverNotification, registerNotificationHandler };
