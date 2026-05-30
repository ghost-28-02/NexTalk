const jwt = require('jsonwebtoken');
const { jwtConfig } = require('../../config/jwt.config');
const { AppError } = require('../../core/errors/AppError');
const { ERROR_CODES } = require('../../core/errors/error.codes');

function generateToken(payload) {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, jwtConfig.secret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw AppError.unauthorized('Token expired', ERROR_CODES.TOKEN_EXPIRED);
    }
    throw AppError.unauthorized('Invalid token', ERROR_CODES.TOKEN_INVALID);
  }
}

module.exports = {
  generateToken,
  verifyToken,
};
