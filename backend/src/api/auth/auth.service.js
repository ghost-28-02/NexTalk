const crypto = require('crypto');
const { userRepository } = require('../../database/repositories/user.repository');
const { refreshTokenRepository } = require('../../database/repositories/refresh-token.repository');
const { otpRepository } = require('../../database/repositories/otp.repository');
const { passwordResetTokenRepository } = require('../../database/repositories/password-reset-token.repository');
const { User } = require('../../database/models/User.model');
const { AppError } = require('../../core/errors/AppError');
const { ERROR_CODES } = require('../../core/errors/error.codes');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashTokenId,
  hashTokenForStorage,
  verifyTokenHash,
  getRefreshTokenExpiry,
} = require('../../shared/helpers/token.helper');
const { generateOTP, getOTPExpiry, OTP_TTL_MINUTES } = require('../../shared/helpers/otp.helper');
const { OTP_TYPES } = require('../../database/models/OTP.model');
const { logger } = require('../../shared/utils/logger');
const emailService = require('../../shared/email/email.service');

// Per-email OTP resend cooldown: reject if last OTP was created < this many ms ago.
// This prevents spamming the resend endpoint even within the IP rate-limit window.
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

async function createSession(user, meta = {}) {
  const payload = { userId: user._id.toString(), email: user.email };
  const accessToken = generateAccessToken(payload);
  const { token: refreshToken, jti } = generateRefreshToken(payload);

  const tokenId = hashTokenId(jti);
  const tokenHash = await hashTokenForStorage(jti);

  await refreshTokenRepository.create({
    userId: user._id,
    tokenId,
    tokenHash,
    userAgent: meta.userAgent,
    ip: meta.ip,
    expiresAt: getRefreshTokenExpiry(),
  });

  return { accessToken, refreshToken };
}

async function generateUniqueUsername(firstName, lastName, email) {
  const base = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user';

  // Try base, then base + 3-digit suffix, up to 5 attempts
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}${Math.floor(Math.random() * 900 + 100)}`;
    const exists = await userRepository.findByUsername(candidate);
    if (!exists) return candidate;
  }

  // Fallback: email prefix + 4-digit timestamp
  return `${email.split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 16)}${Date.now().toString().slice(-4)}`;
}

async function signup({ firstName, lastName, email, password }) {
  const existingEmail = await userRepository.findByEmail(email);
  if (existingEmail) throw AppError.conflict('Email already registered', ERROR_CODES.EMAIL_TAKEN);

  const username = await generateUniqueUsername(firstName.trim(), lastName.trim(), email);
  const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();

  // Generate a deterministic avatar URL seeded by username (more unique than firstName)
  const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;

  const user = await userRepository.create({
    username,
    email,
    password,
    firstName,
    lastName,
    displayName,
    avatar: { url: avatarUrl },
  });

  // Send OTP for email verification
  const otp = generateOTP();
  await otpRepository.deleteExpiredForEmail(email, OTP_TYPES.EMAIL_VERIFICATION);
  await otpRepository.create({
    email,
    otp,
    type: OTP_TYPES.EMAIL_VERIFICATION,
    expiresAt: getOTPExpiry(),
  });

  // Send verification email — fire-and-forget (non-fatal if email delivery fails)
  // FUTURE [Queue]: Replace with emailQueue.add('sendVerification', { email, otp, displayName })
  emailService.sendVerificationEmail(email, otp, displayName).catch((err) =>
    logger.error('[Auth] Failed to send verification email', { email, err: err.message })
  );

  return user;
}

async function login({ identifier, password }, meta = {}) {
  const user = await userRepository.findByEmailOrUsername(identifier);
  // Use a single generic message for both "no user" and "wrong password"
  // — prevents account enumeration attacks (attacker can't tell if the account exists)
  if (!user) throw AppError.unauthorized('Invalid credentials', ERROR_CODES.INVALID_CREDENTIALS);

  if (!user.isActive) throw AppError.unauthorized('Account is disabled', ERROR_CODES.ACCOUNT_DISABLED);

  const userDoc = await User.findById(user._id).select('+password');
  const isMatch = await userDoc.comparePassword(password);
  if (!isMatch) throw AppError.unauthorized('Invalid credentials', ERROR_CODES.INVALID_CREDENTIALS);

  const tokens = await createSession(user, meta);
  return { user, tokens };
}

async function refreshSession(rawRefreshToken, meta = {}) {
  const decoded = verifyRefreshToken(rawRefreshToken);
  const tokenId = hashTokenId(decoded.jti);
  const stored = await refreshTokenRepository.findByTokenId(tokenId);

  if (!stored) {
    // Token not in DB — replay attack or TTL-expired
    await refreshTokenRepository.revokeAllForUser(decoded.userId);
    logger.warn('[Auth] Refresh token reuse detected', { userId: decoded.userId });
    throw AppError.unauthorized('Session invalidated — please log in again', ERROR_CODES.REFRESH_TOKEN_REUSED);
  }

  const isValid = await verifyTokenHash(decoded.jti, stored.tokenHash);
  if (!isValid) {
    await refreshTokenRepository.revokeAllForUser(decoded.userId);
    throw AppError.unauthorized('Session invalidated — please log in again', ERROR_CODES.REFRESH_TOKEN_REUSED);
  }

  await refreshTokenRepository.revokeByTokenId(tokenId);

  const user = await userRepository.findById(decoded.userId);
  if (!user || !user.isActive) throw AppError.unauthorized('User not found', ERROR_CODES.TOKEN_INVALID);

  const tokens = await createSession(user, meta);
  return { user, tokens };
}

async function logout(rawRefreshToken) {
  try {
    const decoded = verifyRefreshToken(rawRefreshToken);
    const tokenId = hashTokenId(decoded.jti);
    await refreshTokenRepository.revokeByTokenId(tokenId);
  } catch {
    // Token already invalid — logout is idempotent
  }
}

async function logoutAll(userId) {
  await refreshTokenRepository.revokeAllForUser(userId);
}

async function verifyEmail({ email, otp }) {
  const record = await otpRepository.findLatestValid(email, OTP_TYPES.EMAIL_VERIFICATION);
  if (!record || record.otp !== otp) {
    throw AppError.badRequest('Invalid or expired OTP', ERROR_CODES.INVALID_OTP);
  }

  await otpRepository.markUsed(record._id);

  const user = await userRepository.findByEmail(email);
  await userRepository.updateById(user._id, { isEmailVerified: true });

  // Send welcome email after first verification — fire-and-forget
  // FUTURE [Queue]: emailQueue.add('sendWelcome', { email, displayName: user.displayName })
  const displayName = user.displayName || user.username;
  emailService.sendWelcomeEmail(email, displayName).catch((err) =>
    logger.error('[Auth] Failed to send welcome email', { email, err: err.message })
  );
}

async function resendVerification({ email }) {
  const user = await userRepository.findByEmail(email);
  if (!user) return; // Silent — don't reveal if email exists

  if (user.isEmailVerified) {
    throw AppError.conflict('Email already verified', ERROR_CODES.EMAIL_ALREADY_VERIFIED);
  }

  // Per-email cooldown: reject resends within 60 seconds of the last OTP
  // (IP rate limiting alone is too coarse — rotating proxies bypass it)
  const latest = await otpRepository.findLatestAny(email, OTP_TYPES.EMAIL_VERIFICATION);
  if (latest) {
    const elapsed = Date.now() - new Date(latest.createdAt).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      throw AppError.tooManyRequests(
        `Please wait ${waitSec} second${waitSec !== 1 ? 's' : ''} before requesting a new code`,
        ERROR_CODES.RESEND_TOO_SOON
      );
    }
  }

  const otp = generateOTP();
  await otpRepository.deleteExpiredForEmail(email, OTP_TYPES.EMAIL_VERIFICATION);
  await otpRepository.create({
    email,
    otp,
    type: OTP_TYPES.EMAIL_VERIFICATION,
    expiresAt: getOTPExpiry(),
  });

  // Resend verification email — fire-and-forget
  // FUTURE [Queue]: emailQueue.add('sendVerification', { email, otp, displayName })
  const displayName = user.displayName || user.username;
  emailService.sendVerificationEmail(email, otp, displayName).catch((err) =>
    logger.error('[Auth] Failed to resend verification email', { email, err: err.message })
  );
}

async function forgotPassword({ email }) {
  const user = await userRepository.findByEmail(email);
  // Always succeed — prevents email enumeration
  if (!user) return;

  // Invalidate previous reset tokens for this user
  await passwordResetTokenRepository.deleteAllForUser(user._id);

  const rawToken = crypto.randomUUID();
  await passwordResetTokenRepository.createForUser(user._id, rawToken);

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
  const displayName = user.displayName || user.username;

  // Send password reset email — fire-and-forget
  // FUTURE [Queue]: emailQueue.add('sendPasswordReset', { email, resetUrl, displayName })
  emailService.sendPasswordResetEmail(email, resetUrl, displayName).catch((err) =>
    logger.error('[Auth] Failed to send password reset email', { email, err: err.message })
  );
}

async function resetPassword({ token, newPassword }) {
  const record = await passwordResetTokenRepository.findByRawToken(token);
  if (!record) {
    throw AppError.badRequest('Invalid or expired reset link', ERROR_CODES.INVALID_OTP);
  }

  await passwordResetTokenRepository.markUsed(record._id);

  const userDoc = await User.findById(record.userId);
  if (!userDoc) throw AppError.notFound('User');

  userDoc.password = newPassword;
  await userDoc.save();

  // Invalidate all sessions — user changed password
  await refreshTokenRepository.revokeAllForUser(record.userId);

  logger.info(`[Auth] Password reset for userId: ${record.userId}`);

  // Send security confirmation email — fire-and-forget
  // FUTURE [Queue]: emailQueue.add('sendPasswordResetSuccess', { email: userDoc.email, displayName })
  const displayName = userDoc.displayName || userDoc.username;
  emailService.sendPasswordResetSuccessEmail(userDoc.email, displayName).catch((err) =>
    logger.error('[Auth] Failed to send password reset success email', { err: err.message })
  );
}

module.exports = {
  signup,
  login,
  refreshSession,
  logout,
  logoutAll,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
};
