const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
});

const USER_STATUS = Object.freeze({
  ONLINE: 'online',
  OFFLINE: 'offline',
  AWAY: 'away',
  BUSY: 'busy',
});

const CALL_STATUS = Object.freeze({
  INITIATED: 'initiated',
  RINGING: 'ringing',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  ENDED: 'ended',
  MISSED: 'missed',
  FAILED: 'failed',
});

const MESSAGE_STATUS = Object.freeze({
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
});

module.exports = { HTTP_STATUS, USER_STATUS, CALL_STATUS, MESSAGE_STATUS };
