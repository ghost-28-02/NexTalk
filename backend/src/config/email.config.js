/**
 * Email configuration.
 *
 * Reads Brevo SMTP credentials and sender identity from environment variables.
 *
 * SMTP_LOGIN / SMTP_PASSWORD are Brevo's transactional SMTP credentials.
 * Find them in Brevo dashboard → SMTP & API → SMTP tab.
 *
 * EMAIL_PROVIDER selects the active transport adapter:
 *   brevo    → sends via Brevo SMTP (production)
 *   console  → pretty-prints to terminal (dev / CI, no actual sends)
 *   (auto)   → 'brevo' if BREVO_SMTP_LOGIN is set, otherwise 'console'
 *
 * To switch providers (SendGrid, SES, Resend) in the future:
 *   1. Add a new adapter in src/shared/email/adapters/
 *   2. Add a new case to email.manager.js getAdapter()
 *   3. Change EMAIL_PROVIDER in .env
 */

// Port is read first so `secure` can be derived from it in the same object literal
const _smtpPort = parseInt(process.env.BREVO_SMTP_PORT, 10) || 587;

const emailConfig = {
  provider: process.env.EMAIL_PROVIDER || 'auto',

  // SMTP credentials (Brevo transactional SMTP)
  //
  // Supported port / TLS combinations:
  //   587  + secure:false  → STARTTLS (standard — often blocked by firewalls/ISPs)
  //   465  + secure:true   → Implicit TLS / SSL (recommended when 587 is blocked)
  //   2525 + secure:false  → STARTTLS alternative port (backup if both 587 and 465 fail)
  //
  // `secure` is auto-derived from port:
  //   465 → true (implicit TLS)
  //   anything else → false (STARTTLS)
  // Override explicitly with BREVO_SMTP_SECURE=true|false if needed.
  smtp: {
    host:   process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
    port:   _smtpPort,
    secure: false,
    login:    process.env.BREVO_SMTP_LOGIN    || '',
    password: process.env.BREVO_SMTP_PASSWORD || '',
  },

  // Sender identity — must be a verified sender in your Brevo account
  from: {
    name:    process.env.EMAIL_FROM_NAME    || 'NexTalk',
    address: process.env.EMAIL_FROM_ADDRESS || 'noreply@nextalk.app',
  },
};

/**
 * Warn (not throw) if email env vars are missing — the app still boots and
 * works for all non-email features; auth flows silently fall back to the
 * console adapter in development.
 *
 * Call this from server.js AFTER validateEnv() so the sequence is clear.
 */
function validateEmailEnv() {
  const isDev = (process.env.NODE_ENV || 'development') === 'development';
  if (isDev) return; // Dev always uses console adapter — no credentials needed

  const missing = ['BREVO_SMTP_LOGIN', 'BREVO_SMTP_PASSWORD', 'EMAIL_FROM_ADDRESS'].filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    // Warn in production — emails will fail silently without these
    console.warn(`[Email] WARNING: Missing env vars for email delivery: ${missing.join(', ')}`);
    console.warn('[Email] All outgoing emails will be suppressed until these are set.');
  }
}

module.exports = { emailConfig, validateEmailEnv };
