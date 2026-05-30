const crypto = require('crypto');
const { userRepository } = require('../../database/repositories/user.repository');
const { otpRepository } = require('../../database/repositories/otp.repository');
const { passwordResetTokenRepository } = require('../../database/repositories/password-reset-token.repository');
const { User } = require('../../database/models/User.model');
const { AppError } = require('../../core/errors/AppError');
const { ERROR_CODES } = require('../../core/errors/error.codes');
const { generateToken } = require('../../shared/helpers/token.helper');
const { generateOTP, getOTPExpiry } = require('../../shared/helpers/otp.helper');
const { OTP_TYPES } = require('../../database/models/OTP.model');
const { logger } = require('../../shared/utils/logger');
const emailService = require('../../shared/email/email.service');

// Per-email OTP resend cooldown: reject if last OTP was created < this many ms ago.
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

async function generateUniqueUsername(firstName, lastName, email) {
  const base = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user';

  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}${Math.floor(Math.random() * 900 + 100)}`;
    const exists = await userRepository.findByUsername(candidate);
    if (!exists) return candidate;
  }

  return `${email.split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 16)}${Date.now().toString().slice(-4)}`;
}

async function signup({ firstName, lastName, email, password }) {
  const existingEmail = await userRepository.findByEmail(email);
  if (existingEmail) throw AppError.conflict('Email already registered', ERROR_CODES.EMAIL_TAKEN);

  const username = await generateUniqueUsername(firstName.trim(), lastName.trim(), email);
  const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
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

  const otp = generateOTP();
  await otpRepository.deleteExpiredForEmail(email, OTP_TYPES.EMAIL_VERIFICATION);
  await otpRepository.create({
    email,
    otp,
    type: OTP_TYPES.EMAIL_VERIFICATION,
    expiresAt: getOTPExpiry(),
  });

  emailService.sendVerificationEmail(email, otp, displayName).catch((err) =>
    logger.error('[Auth] Failed to send verification email', { email, err: err.message })
  );

  return user;
}

async function login({ identifier, password }) {
  const user = await userRepository.findByEmailOrUsername(identifier);
  if (!user) throw AppError.unauthorized('Invalid credentials', ERROR_CODES.INVALID_CREDENTIALS);
  if (!user.isActive) throw AppError.unauthorized('Account is disabled', ERROR_CODES.ACCOUNT_DISABLED);

  const userDoc = await User.findById(user._id).select('+password');
  const isMatch = await userDoc.comparePassword(password);
  if (!isMatch) throw AppError.unauthorized('Invalid credentials', ERROR_CODES.INVALID_CREDENTIALS);

  // Generate JWT with email and id in payload
  const token = generateToken({ email: user.email, id: user._id.toString() });

  return { user, token };
}

async function verifyEmail({ email, otp }) {
  const record = await otpRepository.findLatestValid(email, OTP_TYPES.EMAIL_VERIFICATION);
  if (!record || record.otp !== otp) {
    throw AppError.badRequest('Invalid or expired OTP', ERROR_CODES.INVALID_OTP);
  }

  await otpRepository.markUsed(record._id);

  const user = await userRepository.findByEmail(email);
  await userRepository.updateById(user._id, { isEmailVerified: true });

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

  const displayName = user.displayName || user.username;
  emailService.sendVerificationEmail(email, otp, displayName).catch((err) =>
    logger.error('[Auth] Failed to resend verification email', { email, err: err.message })
  );
}

async function forgotPassword({ email }) {
  const user = await userRepository.findByEmail(email);
  if (!user) return; // Silent — prevents email enumeration

  await passwordResetTokenRepository.deleteAllForUser(user._id);

  const rawToken = crypto.randomUUID();
  await passwordResetTokenRepository.createForUser(user._id, rawToken);

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
  const displayName = user.displayName || user.username;

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

  logger.info(`[Auth] Password reset for userId: ${record.userId}`);

  const displayName = userDoc.displayName || userDoc.username;
  emailService.sendPasswordResetSuccessEmail(userDoc.email, displayName).catch((err) =>
    logger.error('[Auth] Failed to send password reset success email', { err: err.message })
  );
}

module.exports = {
  signup,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
};
