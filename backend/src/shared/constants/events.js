/**
 * Socket.IO event names — single canonical source of truth.
 *
 * Naming convention: <domain>:<action>
 *   Domain:  chat | presence | call | notification | system
 *   Action:  snake_case verbs
 *
 * IMPORTANT: The frontend mirrors these names exactly in
 *   src/features/socket/constants/socketEvents.js
 * Any rename here MUST be reflected there.
 */

const CHAT_EVENTS = Object.freeze({
  JOIN_ROOM:          'chat:join_room',
  LEAVE_ROOM:         'chat:leave_room',
  NEW_MESSAGE:        'chat:new_message',
  MESSAGE_SENT:       'chat:message_sent',
  MESSAGE_DELIVERED:  'chat:message_delivered',
  MESSAGE_READ:       'chat:message_read',
  TYPING_START:       'chat:typing_start',
  TYPING_STOP:        'chat:typing_stop',
  MESSAGE_DELETED:    'chat:message_deleted',
  MESSAGE_EDITED:     'chat:message_edited',   // broadcast when a message is edited
  REACTION_ADDED:     'chat:reaction_added',
  UNREAD_UPDATED:     'chat:unread_updated',   // cross-device unread badge sync
  CHAT_UPDATED:       'chat:chat_updated',     // group name / avatar change
  /**
   * Server → Client: emitted to `user:{targetUserId}` when another user
   * creates a new direct chat with them. Carries the full Chat DTO shaped
   * from the target user's perspective so the recipient's sidebar updates
   * instantly without a page refresh.
   */
  NEW_CHAT:           'chat:new_chat',
});

const PRESENCE_EVENTS = Object.freeze({
  USER_ONLINE:   'presence:user_online',
  USER_OFFLINE:  'presence:user_offline',
  STATUS_CHANGE: 'presence:status_change',
  BULK_STATUS:   'presence:bulk_status',
});

const NOTIFICATION_EVENTS = Object.freeze({
  NEW:      'notification:new',
  READ:     'notification:read',
  READ_ALL: 'notification:read_all',
});

const SYSTEM_EVENTS = Object.freeze({
  ERROR: 'system:error',
  PING:  'system:ping',
  PONG:  'system:pong',
  /**
   * Emitted by the server to the specific socket when the access token has expired
   * mid-session. The client should call POST /auth/refresh, then reconnect:
   *   socket.auth.token = newAccessToken; socket.connect();
   */
  TOKEN_EXPIRED: 'system:token_expired',
  /**
   * Emitted for non-recoverable auth failures (token invalid, account disabled).
   * The client should redirect to /login.
   */
  AUTH_ERROR: 'system:auth_error',
});

/**
 * User profile events.
 * Server → Client: pushed to the user's personal room AND to every
 * chat:{chatId} room the user is a member of, so all connected chat
 * participants see name/avatar changes instantly.
 */
const USER_EVENTS = Object.freeze({
  PROFILE_UPDATED: 'user:profile_updated',
});

module.exports = {
  CHAT_EVENTS,
  PRESENCE_EVENTS,
  NOTIFICATION_EVENTS,
  SYSTEM_EVENTS,
  USER_EVENTS,
};
