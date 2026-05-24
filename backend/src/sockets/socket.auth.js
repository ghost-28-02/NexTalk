const { verifyAccessToken, extractTokenFromHeader } = require('../shared/helpers/token.helper');
const { userRepository } = require('../database/repositories/user.repository');
const { ERROR_CODES } = require('../core/errors/error.codes');
const { logger } = require('../shared/utils/logger');

/**
 * Socket.IO authentication middleware.
 * Clients must send the access token in the handshake:
 *   socket = io(URL, { auth: { token: accessToken } })
 *
 * On success: socket.user is populated (same shape as req.user in HTTP middleware).
 *
 * On failure: connection is rejected. The error object carries a `data.code` field
 * so the client can take the correct recovery action:
 *
 *   TOKEN_EXPIRED  → call POST /auth/refresh, get new accessToken, reconnect socket
 *   TOKEN_MISSING  → redirect to /login
 *   TOKEN_INVALID  → redirect to /login
 *   ACCOUNT_DISABLED → show "account disabled" message, do NOT retry
 *
 * Client-side example:
 *   socket.on('connect_error', (err) => {
 *     if (err.data?.code === 'TOKEN_EXPIRED') {
 *       refreshToken().then(newToken => {
 *         socket.auth.token = newToken;
 *         socket.connect();
 *       });
 *     }
 *   });
 *
 * NOTE: Access tokens are short-lived (15m). Socket.IO re-runs this middleware
 * automatically on every reconnect attempt, so updating socket.auth.token and
 * calling socket.connect() is enough to re-authenticate.
 */
async function socketAuth(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      extractTokenFromHeader(socket.handshake.headers?.authorization);

    if (!token) {
      const err = new Error('Authentication required');
      err.data = { code: ERROR_CODES.TOKEN_MISSING };
      return next(err);
    }

    const decoded = verifyAccessToken(token);
    const user = await userRepository.findById(decoded.userId, '-password');

    if (!user) {
      const err = new Error('User not found');
      err.data = { code: ERROR_CODES.TOKEN_INVALID };
      return next(err);
    }

    if (!user.isActive) {
      const err = new Error('Account is disabled');
      err.data = { code: ERROR_CODES.ACCOUNT_DISABLED };
      return next(err);
    }

    socket.user = user;
    next();
  } catch (err) {
    logger.warn('[Socket] Auth failed', { message: err.message, code: err.code, id: socket.id });

    // Distinguish expired token from other failures so the client can recover
    const socketErr = new Error(err.message || 'Authentication failed');
    socketErr.data = {
      code: err.code === ERROR_CODES.TOKEN_EXPIRED
        ? ERROR_CODES.TOKEN_EXPIRED
        : ERROR_CODES.TOKEN_INVALID,
    };
    next(socketErr);
  }
}

module.exports = { socketAuth };
