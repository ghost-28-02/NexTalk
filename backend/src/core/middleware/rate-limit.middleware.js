const { AppError } = require('../errors/AppError');

/**
 * Minimal in-memory rate limiter (Map-based sliding window).
 *
 * FUTURE: Replace Map store with Redis INCR + EXPIRE for multi-instance deployments.
 * Drop-in: swap `store` Map operations with `redisClient.incr(key)` + `redisClient.expire(key, windowSec)`.
 */
function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 100, keyFn = null, message = null } = {}) {
  // FUTURE [Redis]: Replace this Map with Redis store
  const store = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of store.entries()) {
      if (now > data.resetAt) store.delete(key);
    }
  }, windowMs);

  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.ip;
    const now = Date.now();
    const resetAt = now + windowMs;

    const existing = store.get(key);

    if (!existing || now > existing.resetAt) {
      store.set(key, { count: 1, resetAt });
      return next();
    }

    existing.count += 1;

    if (existing.count > max) {
      res.set('Retry-After', Math.ceil((existing.resetAt - now) / 1000));
      return next(AppError.tooManyRequests(message || 'Too many requests, please slow down'));
    }

    return next();
  };
}

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `auth:${req.ip}`,
  message: 'Too many auth attempts, try again in 15 minutes',
});

/**
 * Stricter limiter for /refresh — this endpoint mints new access tokens,
 * so brute-forcing it would allow token farming from a stolen refresh cookie.
 * 15 attempts per 10 minutes is generous for legitimate clients (which refresh
 * at most once every 15 minutes per device) but blocks automated abuse.
 *
 * FUTURE [Redis]: key pattern `refresh:{userId}` (extracted from decoded cookie) is
 * more precise than IP, but requires decoding the cookie before rate-checking.
 */
const refreshRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 15,
  keyFn: (req) => `refresh:${req.ip}`,
  message: 'Too many token refresh attempts, please slow down',
});

const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyFn: (req) => `api:${req.ip}`,
});

module.exports = { createRateLimiter, authRateLimiter, refreshRateLimiter, apiRateLimiter };
