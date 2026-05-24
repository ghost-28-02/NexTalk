/**
 * Console Email Adapter — development fallback.
 *
 * Implements the same interface as brevo.adapter.js but instead of sending
 * mail it pretty-prints the email to the terminal so developers can read
 * OTPs and reset links without needing real email credentials.
 *
 * Activated when:
 *   - EMAIL_PROVIDER=console
 *   - NODE_ENV=development and BREVO_SMTP_LOGIN is not set
 *
 * Interface contract (every adapter must satisfy):
 *   sendMail({ to, subject, html, text }) → Promise<{ messageId: string }>
 */

const { logger } = require('../../../shared/utils/logger');

const consoleAdapter = {
  async sendMail({ to, subject, html: _html, text }) {
    // Strip HTML for a clean terminal read — fall back to text if available
    const body = text || '[No plain-text body]';

    logger.info(
      `\n${'═'.repeat(60)}\n` +
      `📧  EMAIL (console adapter — not actually sent)\n` +
      `${'─'.repeat(60)}\n` +
      `To:      ${to}\n` +
      `Subject: ${subject}\n` +
      `${'─'.repeat(60)}\n` +
      `${body}\n` +
      `${'═'.repeat(60)}`
    );

    return { messageId: `console-${Date.now()}` };
  },
};

module.exports = consoleAdapter;
