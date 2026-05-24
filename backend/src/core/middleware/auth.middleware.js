const { verifyAccessToken, extractTokenFromHeader } = require('../../shared/helpers/token.helper');
const { userRepository } = require('../../database/repositories/user.repository');
const { AppError } = require('../errors/AppError');
const { ERROR_CODES } = require('../errors/error.codes');
const { ROLE_HIERARCHY } = require('../../shared/constants/roles');
const { asyncHandler } = require('../../shared/utils/async-handler');

/**
 * Short-lived in-memory user cache — eliminates a MongoDB round-trip on every
 * protected request for recently active users.
 *
 * TTL: 60 seconds. Trade-off: a deactivated account can continue making requests
 * for up to 60 seconds after deactivation. Acceptable for a chat app; reduce TTL
 * (or remove cache) for higher-security routes.
 *
 * FUTURE [Redis]: replace Map operations with:
 *   await redisClient.get(`user:cache:${userId}`) / redisClient.set(..., 'EX', 60)
 *   Works identically across multiple server instances without any handler changes.
 */
const USER_CACHE_TTL_MS = 60 * 1000;
const userCache = new Map(); // userId (string) → { user, cachedAt }

// Evict expired entries periodically so the Map doesn't grow unboundedly
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of userCache.entries()) {
    if (now - entry.cachedAt >= USER_CACHE_TTL_MS) userCache.delete(id);
  }
}, USER_CACHE_TTL_MS);

/**
 * Verifies JWT access token and attaches req.user.
 * Tokens are short-lived (15m) and NOT stored server-side — verification is stateless.
 * FUTURE: if token blacklisting is needed, check Redis SET here before allowing.
 */
const protect = asyncHandler(async (req, res, next) => {
  const token = extractTokenFromHeader(req.headers.authorization);

  if (!token) {
    throw AppError.unauthorized('Authentication required', ERROR_CODES.TOKEN_MISSING);
  }

  const decoded = verifyAccessToken(token);
  const userId = decoded.userId;

  // --- Cache hit: skip DB lookup for recently verified users ---
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.cachedAt < USER_CACHE_TTL_MS) {
    req.user = cached.user;
    return next();
  }

  // --- Cache miss: fetch from DB and populate cache ---
  const user = await userRepository.findById(userId, '-password');

  if (!user) {
    userCache.delete(userId);
    throw AppError.unauthorized('User no longer exists', ERROR_CODES.TOKEN_INVALID);
  }

  if (!user.isActive) {
    userCache.delete(userId); // Evict immediately — deactivated accounts must not linger
    throw AppError.unauthorized('Account is disabled', ERROR_CODES.ACCOUNT_DISABLED);
  }

  userCache.set(userId, { user, cachedAt: Date.now() });
  req.user = user;
  next();
});

/**
 * Attach user if token present, but don't block unauthenticated requests.
 * Useful for public routes that have optional personalization.
 */
const optionalProtect = asyncHandler(async (req, res, next) => {
  const token = extractTokenFromHeader(req.headers.authorization);
  if (!token) return next();

  try {
    const decoded = verifyAccessToken(token);
    const user = await userRepository.findById(decoded.userId, '-password');
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
