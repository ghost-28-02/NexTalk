const { Notification } = require('../../database/models/Notification.model');
const { toNotificationDTO } = require('./notification.dto');

/**
 * Notification service.
 *
 * Pagination strategy — cursor-based (consistent with messages):
 *   Initial:    GET /notifications?limit=20         → 20 newest
 *   Load more:  GET /notifications?before={id}      → 20 before that id
 *
 * Why cursor over offset?
 *   New notifications arriving between page loads would shift offset pages,
 *   causing duplicates or gaps. Cursor (_id) is stable under concurrent inserts.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLimit(query, defaultLimit = 20, maxLimit = 50) {
  return Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
}

// ─── Service functions ────────────────────────────────────────────────────────

async function getUserNotifications(userId, query) {
  const limit  = parseLimit(query);
  const before = query.before || null;

  const filter = { recipient: userId };
  if (before) filter._id = { $lt: before };

  const raw = await Notification.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('sender', 'username displayName avatar')
    .lean();

  const hasMore    = raw.length > limit;
  const items      = hasMore ? raw.slice(0, limit) : raw;
  const nextCursor = hasMore ? items[items.length - 1]._id : null;

  return {
    notifications: items.map(toNotificationDTO),
    hasMore,
    nextCursor: nextCursor?.toString() ?? null,
  };
}

async function markRead(notificationId, userId) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { isRead: true, readAt: new Date() },
    { new: true, lean: true }
  ).populate('sender', 'username displayName avatar');
  return notification ? toNotificationDTO(notification) : null;
}

async function markAllRead(userId) {
  return Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
}

async function deleteNotification(notificationId, userId) {
  return Notification.findOneAndDelete({ _id: notificationId, recipient: userId });
}

async function getUnreadCount(userId) {
  return Notification.countDocuments({ recipient: userId, isRead: false });
}

/**
 * Create and persist a notification document.
 * Called by chat.handler (offline member notification) and any service
 * that needs to notify a user (contact requests, mentions, calls, etc.).
 *
 * Does NOT deliver via socket — callers must call deliverNotification() separately.
 */
async function createNotification(data) {
  return Notification.create(data);
}

module.exports = {
  getUserNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  getUnreadCount,
  createNotification,
};
