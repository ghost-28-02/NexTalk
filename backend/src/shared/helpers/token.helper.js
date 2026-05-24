const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { jwtConfig } = require('../../config/jwt.config');
const { AppError } = require('../../core/errors/AppError');
const { ERROR_CODES } = require('../../core/errors/error.codes');

function generateAccessToken(payload) {
  return jwt.sign(payload, jwtConfig.access.secret, {
    expiresIn: jwtConfig.access.expiresIn,
  });
}

function generateRefreshToken(payload) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ ...payload, jti }, jwtConfig.refresh.secret, {
    expiresIn: jwtConfig.refresh.expiresIn,
  });
  return { token, jti };
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, jwtConfig.access.secret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw AppError.unauthorized('Access token expired', ERROR_CODES.TOKEN_EXPIRED);
    }
    throw AppError.unauthorized('Invalid access token', ERROR_CODES.TOKEN_INVALID);
  }
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, jwtConfig.refresh.secret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw AppError.unauthorized('Refresh token expired', ERROR_CODES.REFRESH_TOKEN_INVALID);
    }
    throw AppError.unauthorized('Invalid refresh token', ERROR_CODES.REFRESH_TOKEN_INVALID);
  }
}

function hashTokenId(jti) {
  return crypto.createHash('sha256').update(jti).digest('hex');
}

async function hashTokenForStorage(jti) {
  return bcrypt.hash(jti, 10);
}

async function verifyTokenHash(jti, hash) {
  return bcrypt.compare(jti, hash);
}

function extractTokenFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

function getRefreshTokenExpiry() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashTokenId,
  hashTokenForStorage,
  verifyTokenHash,
  extractTokenFromHeader,
  getRefreshTokenExpiry,
};
