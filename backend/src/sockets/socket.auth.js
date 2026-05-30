const { verifyToken } = require('../shared/helpers/token.helper');
const { userRepository } = require('../database/repositories/user.repository');
const { ERROR_CODES } = require('../core/errors/error.codes');
const { logger } = require('../shared/utils/logger');

/**
 * Socket.IO authentication middleware.
 * Reads the JWT from socket.handshake.auth.token — passed explicitly by the
 * client because sockets connect directly to the backend (bypassing the Next.js
 * proxy), so the httpOnly cookie is not available on the backend domain.
 */
async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      const err = new Error('Authentication required');
      err.data = { code: ERROR_CODES.TOKEN_MISSING };
      return next(err);
    }

    const decoded = verifyToken(token);
    const user = await userRepository.findById(decoded.id, '-password');

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
