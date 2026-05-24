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
});

export const PRESENCE_EVENTS = Object.freeze({
  USER_ONLINE:   'presence:user_online',
  USER_OFFLINE:  'presence:user_offline',
  STATUS_CHANGE: 'presence:status_change',
  BULK_STATUS:   'presence:bulk_status',
});

/**
 * Call signaling events.
 * Client → Server: INITIATE, ACCEPT, DECLINE, END, RECONNECT,
 *                  ICE_CANDIDATE, SDP_OFFER, SDP_ANSWER,
 *                  NOTIFY_MUTED, NOTIFY_VIDEO_OFF
 * Server → Client: INCOMING, ACCEPTED, DECLINED, ENDED, MISSED,
 *                  ICE_CANDIDATE (relayed), SDP_OFFER (relayed), SDP_ANSWER (relayed),
 *                  REMOTE_MUTED, REMOTE_VIDEO_OFF
 */
export const CALL_EVENTS = Object.freeze({
  // Client → Server
  INITIATE:         'call:initiate',
  ACCEPT:           'call:accept',
  DECLINE:          'call:decline',
  END:              'call:end',
  RECONNECT:        'call:reconnect',
  ICE_CANDIDATE:    'call:ice_candidate',
  SDP_OFFER:        'call:sdp_offer',
  SDP_ANSWER:       'call:sdp_answer',
  NOTIFY_MUTED:     'call:notify_muted',
  NOTIFY_VIDEO_OFF: 'call:notify_video_off',

  // Server → Client
  INCOMING:         'call:incoming',
  ACCEPTED:         'call:accepted',
  DECLINED:         'call:declined',
  ENDED:            'call:ended',
  MISSED:           'call:missed',
  REMOTE_MUTED:     'call:remote_muted',
  REMOTE_VIDEO_OFF: 'call:remote_video_off',
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
