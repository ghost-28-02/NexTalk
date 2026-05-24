/**
 * Email Service — domain-level email dispatch functions.
 *
 * This is the ONLY module that auth.service.js (or any feature service) imports.
 * It maps high-level domain events to the correct template + manager call.
 *
 * auth.service.js never imports adapters or templates directly — always through here.
 * This keeps the dependency graph clean: feature → email.service → email.manager → adapter.
 *
 * All functions return the result of sendMail() (messageId or null).
 * They are designed to be called fire-and-forget:
 *   emailService.sendVerificationEmail(...).catch(() => {});
 *   — OR —
 *   await emailService.sendVerificationEmail(...); // awaited but non-fatal
 *
 * FUTURE [Queue]: Each function here becomes a "job enqueuer" rather than a
 * direct call, once BullMQ is wired in. The function signature stays the same.
 */

const { sendMail }                        = require('./email.manager');
const { verificationTemplate }            = require('./templates/verification.template');
const { welcomeTemplate }                 = require('./templates/welcome.template');
const { forgotPasswordTemplate }          = require('./templates/forgot-password.template');
const { passwordResetSuccessTemplate }    = require('./templates/password-reset-success.template');
const { OTP_TTL_MINUTES }                 = require('../../shared/helpers/otp.helper');

// ─── Auth emails ─────────────────────────────────────────────────────────────

/**
 * Send a 6-digit OTP email for email address verification.
 * Triggered by: signup, resend-verification
 *
 * @param {string} email
 * @param {string} otp         — plaintext OTP (not hashed)
 * @param {string} displayName — user's display name for personalisation
 */
async function sendVerificationEmail(email, otp, displayName) {
  const { subject, html, text } = verificationTemplate({
    name:             displayName,
    otp,
    expiresInMinutes: OTP_TTL_MINUTES,
  });

  return sendMail({ to: email, subject, html, text });
}

/**
 * Send a welcome email after the user verifies their email for the first time.
 * Triggered by: first successful /auth/verify-email
 *
 * @param {string} email
 * @param {string} displayName
 */
async function sendWelcomeEmail(email, displayName) {
  const { subject, html, text } = welcomeTemplate({ name: displayName });
  return sendMail({ to: email, subject, html, text });
}

/**
 * Send a password reset link.
 * Triggered by: POST /auth/forgot-password
 *
 * @param {string} email
 * @param {string} resetUrl    — full URL including the raw token as query param
 * @param {string} displayName
 */
async function sendPasswordResetEmail(email, resetUrl, displayName) {
  const { subject, html, text } = forgotPasswordTemplate({
    name:           displayName,
    resetUrl,
    expiresInHours: 1, // Matches passwordResetTokenRepository.createForUser() TTL
  });

  return sendMail({ to: email, subject, html, text });
}

/**
 * Send a password-change confirmation for security awareness.
 * Triggered by: POST /auth/reset-password (after success)
 *
 * @param {string} email
 * @param {string} displayName
 */
async function sendPasswordResetSuccessEmail(email, displayName) {
  const { subject, html, text } = passwordResetSuccessTemplate({ name: displayName });
  return sendMail({ to: email, subject, html, text });
}

// ─── Future email types (add implementations here as features grow) ───────────
// sendLoginAlertEmail(email, displayName, { device, ip, location })
// sendContactRequestEmail(email, displayName, fromName)
// sendGroupInviteEmail(email, displayName, groupName, inviterName, joinUrl)
// sendWeeklyDigestEmail(email, displayName, stats)

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordResetSuccessEmail,
};
