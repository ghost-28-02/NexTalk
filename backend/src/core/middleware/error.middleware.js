const { AppError } = require('../errors/AppError');
const { ApiResponse } = require('../response/api.response');
const { logger } = require('../../shared/utils/logger');
const { HTTP_STATUS } = require('../../shared/constants/status');

function handleMongoError(err) {
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return AppError.conflict(`${field} already exists`, 'DUPLICATE_KEY');
  }
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    return AppError.badRequest(message, 'VALIDATION_ERROR');
  }
  if (err.name === 'CastError') {
    return AppError.badRequest(`Invalid value for ${err.path}`, 'INVALID_ID');
  }
  return null;
}

function handleJwtError(err) {
  if (err.name === 'JsonWebTokenError') return AppError.unauthorized('Invalid token', 'TOKEN_INVALID');
  if (err.name === 'TokenExpiredError') return AppError.unauthorized('Token expired', 'TOKEN_EXPIRED');
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  let error = err;

  const mongoError = handleMongoError(err);
  if (mongoError) error = mongoError;

  const jwtError = handleJwtError(err);
  if (jwtError) error = jwtError;

  if (!(error instanceof AppError)) {
    logger.error('Unhandled error', { message: err.message, stack: err.stack, path: req.path });
    return ApiResponse.error(res, 'Something went wrong', HTTP_STATUS.INTERNAL_ERROR, 'INTERNAL_ERROR');
  }

  if (error.statusCode >= 500) {
    logger.error('Operational error 5xx', { message: error.message, path: req.path });
  }

  return ApiResponse.error(res, error.message, error.statusCode, error.code, error.data ?? null);
}

function notFoundMiddleware(req, res) {
  return ApiResponse.error(res, `Cannot ${req.method} ${req.path}`, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND');
}

module.exports = { errorMiddleware, notFoundMiddleware };
