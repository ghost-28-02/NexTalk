/**
 * Call-specific constants.
 *
 * SOCKET_EVENTS here mirror src/features/socket/constants/socketEvents.js CALL_EVENTS.
 * They are duplicated here for ergonomics (call feature imports from its own domain).
 * The canonical source is the backend events.js — all three files must stay in sync.
 */

export const CALL_STATE = {
  IDLE:         'idle',
  RINGING:      'ringing',    // incoming, not yet answered
  OUTGOING:     'outgoing',   // caller initiated, ringing remote
  CONNECTING:   'connecting', // accepted, WebRTC negotiating
  CONNECTED:    'connected',  // WebRTC peer connection established
  RECONNECTING: 'reconnecting',
  ENDED:        'ended',
  MISSED:       'missed',
  DECLINED:     'declined',
  FAILED:       'failed',
};

export const CALL_TYPE = {
  AUDIO: 'audio',
  VIDEO: 'video',
};

export const CALL_DIRECTION = {
  INCOMING: 'incoming',
  OUTGOING: 'outgoing',
};

/**
 * Socket event names for the call feature.
 * Must match backend src/shared/constants/events.js CALL_EVENTS exactly.
 */
export const SOCKET_EVENTS = {
  // Client → Server
  CALL_INITIATE:    'call:initiate',
  CALL_ACCEPT:      'call:accept',
  CALL_DECLINE:     'call:decline',
  CALL_END:         'call:end',
  CALL_RECONNECT:   'call:reconnect',
  ICE_CANDIDATE:    'call:ice_candidate',       // ← underscore (was hyphen — fixed)
  OFFER:            'call:sdp_offer',           // ← sdp_ prefix (was bare — fixed)
  ANSWER:           'call:sdp_answer',          // ← sdp_ prefix (was bare — fixed)
  NOTIFY_MUTED:     'call:notify_muted',        // ← underscore (was hyphen — fixed)
  NOTIFY_VIDEO_OFF: 'call:notify_video_off',    // ← underscore (was hyphen — fixed)

  // Server → Client
  CALL_INCOMING:    'call:incoming',
  CALL_ACCEPTED:    'call:accepted',            // ← was 'call:accept' re-emitted — fixed
  CALL_DECLINED:    'call:declined',            // ← was 'call:decline' re-emitted — fixed
  CALL_ENDED:       'call:ended',               // ← was 'call:end' re-emitted — fixed
  CALL_MISSED:      'call:missed',
  REMOTE_MUTED:     'call:remote_muted',        // ← underscore (was hyphen — fixed)
  REMOTE_VIDEO_OFF: 'call:remote_video_off',    // ← underscore (was hyphen — fixed)
};

export const CALL_OUTCOME = {
  ENDED:    'ended',
  DECLINED: 'declined',
  MISSED:   'missed',
  FAILED:   'failed',
};

export const MEDIA_CONSTRAINTS = {
  audio: {
    echoCancellation:  true,
    noiseSuppression:  true,
    autoGainControl:   true,
    sampleRate:        48000,
  },
  video: {
    width:     { ideal: 1280 },
    height:    { ideal: 720 },
    frameRate: { ideal: 30 },
    facingMode: 'user',
  },
};

export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // TURN servers injected at runtime from /api/v1/calls/ice-credentials
];

export const CALL_TIMEOUTS = {
  RING_TIMEOUT_MS:         30_000,
  RECONNECT_TIMEOUT_MS:    10_000,
  ICE_GATHERING_TIMEOUT_MS: 10_000,
};
