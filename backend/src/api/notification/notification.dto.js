/**
 * Notification DTO — shapes notification documents for API responses.
 *
 * Matches the frontend mock/notifications.js shape:
 *   { id, type, title, description, timestamp, isRead, avatar }
 *
 * `description`:
 *   The DB field is `body`. The DTO exposes it as `description` to match
 *   the frontend mock and keep component code clean.
 *
 * `avatar`:
 *   Extracted from the populated `sender` document (URL string, not object).
 *   Null for system notifications that have no sender.
 *
 * `type` values match frontend constants/app.js NOTIFICATION_TYPES:
 *   'message', 'call', 'mention', 'contact_request',
 *   'contact_accepted', 'group_invite', 'system'
 *   — these are now the values stored directly in the DB (Notification.model.js).
 */

function toNotificationDTO(notification) {
  const sender = notification.sender;

  // Extract sender avatar (string URL) if sender was populated
  const senderAvatar =
    sender?.avatar?.url ??
    (typeof sender?.avatar === 'string' ? sender.avatar : null) ??
    null;

  return {
    id:          notification._id,
    type:        notification.type,       // already in frontend format ('message', 'call', …)
    title:       notification.title,
    description: notification.body || '', // DB field 'body' → 'description' for frontend
    isRead:      notification.isRead,
    readAt:      notification.readAt || null,
    // sender info (optional — null for system notifications)
    sender: sender?._id
      ? {
          id:          sender._id,
          username:    sender.username,
          name:        sender.displayName || sender.username,
          avatar:      senderAvatar,
        }
      : null,
    avatar:      senderAvatar,           // top-level shortcut (matches mock shape)
    // raw data payload for deep-linking (e.g., chatId, messageId)
    data:        notification.data || {},
    createdAt:   notification.createdAt,
  };
}

module.exports = { toNotificationDTO };
