/**
 * Email Manager — provider-agnostic email orchestrator.
 *
 * Mirrors the architecture of src/shared/upload/upload.manager.js:
 *   getAdapter() selects the active transport based on EMAIL_PROVIDER env var.
 *
 * Provider switch:
 *   EMAIL_PROVIDER=brevo    → Brevo transactional API
 *   EMAIL_PROVIDER=console  → Dev console adapter (no actual sends)
 *   (auto)                  → console if BREVO_API_KEY absent, brevo if present
 *
 * To add a new provider (SendGrid, SES, Resend):
 *   1. Create src/shared/email/adapters/<provider>.adapter.js (same interface)
 *   2. Add `case '<provider>': return <provider>Adapter;` to getAdapter()
 *   3. Set EMAIL_PROVIDER=<provider> in .env
 *   Zero other code changes required.
 *
 * FUTURE [Queue/BullMQ]:
 *   Replace the direct adapter.sendMail() call in sendMail() with:
 *     return emailQueue.add('send', mailOptions, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
 *   The queue worker then calls adapter.sendMail() with retry/failure tracking.
 *   Add the queue initialisation in server.js next to initSocketManager().
 */

const brevoAdapter   = require('./adapters/brevo.adapter');
const consoleAdapter = require('./adapters/console.adapter');
const { logger }     = require('../../shared/utils/logger');

// ─── Adapter selection ───────────────────────────────────────────────────────

function getAdapter() {
  const provider = (process.env.EMAIL_PROVIDER || 'auto').toLowerCase();

  if (provider === 'brevo')   return brevoAdapter;
  if (provider === 'console') return consoleAdapter;

  // Auto-detect: use Brevo if credentials present, console otherwise (dev default).
  // This means the dev environment works out of the box without any email setup.
  return process.env.BREVO_API_KEY ? brevoAdapter : consoleAdapter;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Send an email through the active transport adapter.
 *
 * This is the only function auth.service.js (or any other domain service)
 * calls — it is completely decoupled from the underlying provider.
 *
 * Never throws — email delivery is fire-and-forget for transactional auth emails.
 * Failures are logged as warnings; they do not interrupt the auth flow.
 * (If delivery failure should block the operation, catch the error at the call site.)
 *
 * @param {{ to: string, subject: string, html: string, text: string }} mailOptions
 * @returns {Promise<{ messageId: string } | null>}
 */
async function sendMail(mailOptions) {
  const adapter = getAdapter();

  try {
    // FUTURE [Queue]: Replace with queue enqueue here
    const result = await adapter.sendMail(mailOptions);
    return result;
  } catch (err) {
    logger.error('[Email] Delivery failed', {
      to:      mailOptions.to,
      subject: mailOptions.subject,
      error:   err.message,
    });
    return null; // Non-fatal — caller decides whether to surface to user
  }
}

/**
 * Returns the name of the currently active email provider.
 * Useful for health checks and admin dashboards.
 */
function getProviderName() {
  const provider = (process.env.EMAIL_PROVIDER || 'auto').toLowerCase();
  if (provider === 'brevo')   return 'brevo';
  if (provider === 'console') return 'console';
  return process.env.BREVO_API_KEY ? 'brevo' : 'console';
}

module.exports = { sendMail, getProviderName };
