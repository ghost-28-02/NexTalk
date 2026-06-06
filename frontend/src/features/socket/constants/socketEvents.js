/**
 * Socket event names — frontend mirror of backend src/shared/constants/events.js
 *
 * IMPORTANT: These must stay in sync with the backend file.
 * Any rename in the backend MUST be reflected here.
 *
 * Naming convention: <domain>:<action>  (snake_case)
 */

export const CHAT_EVENTS = Object.freeze({
  JOIN_ROOM:          'chat:join_room',
  LEAVE_ROOM:         'chat:leave_room',
  NEW_MESSAGE:        'chat:new_message',
  MESSAGE_SENT:       'chat:message_sent',
  MESSAGE_DELIVERED:  'chat:message_delivered',
  MESSAGE_READ:       'chat:message_read',
  TYPING_START:       'chat:typing_start',
  TYPING_STOP:        'chat:typing_stop',
  MESSAGE_DELETED:    'chat:message_deleted',
  MESSAGE_EDITED:     'chat:message_edited',
  REACTION_ADDED:     'chat:reaction_added',
  UNREAD_UPDATED:     'chat:unread_updated',
  CHAT_UPDATED:       'chat:chat_updated',
  /**
   * Server → Client: another user started a direct conversation with us.
   * Payload: { chat: ChatDTO } — shaped from our perspective.
   * We dispatch chatAdded() so the chat appears in the sidebar immediately.
   */
  NEW_CHAT:           'chat:new_chat',
});

export const PRESENCE_EVENTS = Object.freeze({
  USER_ONLINE:   'presence:user_online',
  USER_OFFLINE:  'presence:user_offline',
  STATUS_CHANGE: 'presence:status_change',
  BULK_STATUS:   'presence:bulk_status',
});

export const NOTIFICATION_EVENTS = Object.freeze({
  NEW:      'notification:new',
  READ:     'notification:read',
  READ_ALL: 'notification:read_all',
});

export const SYSTEM_EVENTS = Object.freeze({
  ERROR:         'system:error',
  PING:          'system:ping',
  PONG:          'system:pong',
  TOKEN_EXPIRED: 'system:token_expired',
  AUTH_ERROR:    'system:auth_error',
});

/**
 * User profile events.
 * Server → Client: pushed to user:{userId} personal room AND every chat:{chatId}
 * room the user belongs to, so all connected participants see changes instantly.
 */
export const USER_EVENTS = Object.freeze({
  PROFILE_UPDATED: 'user:profile_updated',
});
