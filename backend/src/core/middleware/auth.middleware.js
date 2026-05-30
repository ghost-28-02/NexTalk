const { verifyToken } = require('../../shared/helpers/token.helper');
const { userRepository } = require('../../database/repositories/user.repository');
const { AppError } = require('../errors/AppError');
const { ERROR_CODES } = require('../errors/error.codes');
const { ROLE_HIERARCHY } = require('../../shared/constants/roles');
const { asyncHandler } = require('../../shared/utils/async-handler');
const { jwtConfig } = require('../../config/jwt.config');

/**
 * Reads JWT from cookie, verifies it, fetches user from DB, attaches req.user.
 */
const protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies[jwtConfig.cookie.name];

  if (!token) {
    throw AppError.unauthorized('Authentication required', ERROR_CODES.TOKEN_MISSING);
  }

  // Decode and verify JWT signature + expiry
  const decoded = verifyToken(token);

  // Fetch user from DB using id from token payload
  const user = await userRepository.findById(decoded.id, '-password');

  if (!user) {
    throw AppError.unauthorized('User no longer exists', ERROR_CODES.TOKEN_INVALID);
  }

  if (!user.isActive) {
    throw AppError.unauthorized('Account is disabled', ERROR_CODES.ACCOUNT_DISABLED);
  }

  req.user = user;
  next();
});

/**
 * Attach user if token present, but don't block unauthenticated requests.
 */
const optionalProtect = asyncHandler(async (req, res, next) => {
  const token = req.cookies[jwtConfig.cookie.name];
  if (!token) return next();

  try {
    const decoded = verifyToken(token);
    const user = await userRepository.findById(decoded.id, '-password');
    if (user && user.isActive) req.user = user;
  } catch {
    // Silently ignore — token invalid but route is optional-auth
  }

  next();
});

/**
 * Role-based access. Must be used AFTER protect middleware.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required', ERROR_CODES.TOKEN_MISSING));
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] ?? -1;
    const minRequired = Math.min(...roles.map((r) => ROLE_HIERARCHY[r] ?? 99));

    if (userLevel < minRequired) {
      return next(AppError.forbidden('Insufficient permissions'));
    }

    next();
  };
}

/**
 * Blocks users who have not verified their email.
 * Must be used AFTER protect middleware.
 */
function requireEmailVerified(req, res, next) {
  if (!req.user.isEmailVerified) {
    return next(AppError.forbidden('Email verification required', ERROR_CODES.EMAIL_NOT_VERIFIED));
  }
  next();
}

module.exports = { protect, optionalProtect, requireRole, requireEmailVerified };
