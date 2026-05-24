/**
 * Email configuration.
 *
 * Reads Brevo API credentials and sender identity from environment variables.
 *
 * BREVO_API_KEY is the transactional email API key from Brevo dashboard → SMTP & API → API keys.
 *
 * EMAIL_PROVIDER selects the active transport adapter:
 *   brevo    → sends via Brevo REST API (production)
 *   console  → pretty-prints to terminal (dev / CI, no actual sends)
 *   (auto)   → 'brevo' if BREVO_API_KEY is set, otherwise 'console'
 */

const emailConfig = {
  provider: process.env.EMAIL_PROVIDER || 'auto',

  // Brevo transactional email API credentials
  apiKey: process.env.BREVO_API_KEY || '',

  // Sender identity — must be a verified sender in your Brevo account
  from: {
    name: process.env.EMAIL_FROM_NAME || 'NexTalk',
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

  const missing = ['BREVO_API_KEY', 'EMAIL_FROM_ADDRESS'].filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    // Warn in production — emails will fail silently without these
    console.warn(`[Email] WARNING: Missing env vars for email delivery: ${missing.join(', ')}`);
    console.warn('[Email] All outgoing emails will be suppressed until these are set.');
  }
}

module.exports = { emailConfig, validateEmailEnv };
