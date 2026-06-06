const { HTTP_STATUS } = require('../../shared/constants/status');

class AppError extends Error {
  constructor(message, statusCode = HTTP_STATUS.INTERNAL_ERROR, code = null, data = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.data = data;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, code) {
    return new AppError(message, HTTP_STATUS.BAD_REQUEST, code);
  }

  static unauthorized(message = 'Unauthorized', code) {
    return new AppError(message, HTTP_STATUS.UNAUTHORIZED, code);
  }

  static forbidden(message = 'Forbidden', code) {
    return new AppError(message, HTTP_STATUS.FORBIDDEN, code);
  }

  static notFound(resource = 'Resource') {
    return new AppError(`${resource} not found`, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND');
  }

  static conflict(message, code) {
    return new AppError(message, HTTP_STATUS.CONFLICT, code);
  }

  static tooManyRequests(message = 'Too many requests') {
    return new AppError(message, HTTP_STATUS.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED');
  }

  static internal(message = 'Internal server error') {
    return new AppError(message, HTTP_STATUS.INTERNAL_ERROR, 'INTERNAL_ERROR');
  }
}

module.exports = { AppError };
