/**
 * Brevo SMTP Adapter — production email transport.
 *
 * Uses Nodemailer with Brevo's transactional SMTP relay.
 * SMTP credentials are obtained from the Brevo dashboard:
 *   Settings → SMTP & API → SMTP tab → Generate new SMTP key
 *
 * Provider-agnostic by design — every field maps to standard SMTP:
 *   - Switch to SendGrid: SMTP_HOST=smtp.sendgrid.net, SMTP_PORT=587
 *   - Switch to SES:      SMTP_HOST=email-smtp.<region>.amazonaws.com
 *   - Switch to Resend:   SMTP_HOST=smtp.resend.com
 *   No code changes required — env vars only.
 *
 * FUTURE [Queue/BullMQ]:
 *   Replace the direct `transporter.sendMail()` call with a queue enqueue:
 *     emailQueue.add('send', { to, subject, html, text }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })
 *   The queue worker then calls transporter.sendMail() with retry logic.
 *   This provides delivery guarantees, failure visibility, and rate control.
 *
 * Interface contract (every adapter must satisfy):
 *   sendMail({ to, subject, html, text }) → Promise<{ messageId: string }>
 */

const nodemailer = require('nodemailer');
const { emailConfig } = require('../../../config/email.config');
const { logger } = require('../../../shared/utils/logger');

// Lazily initialized — transport is created on first use so the adapter
// can be imported without env vars present (e.g., during unit tests).
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host:   emailConfig.smtp.host,
    port:   emailConfig.smtp.port,
    secure: emailConfig.smtp.secure,
    auth: {
      user: emailConfig.smtp.login,
      pass: emailConfig.smtp.password,
    },
    // Connection pool — reuse SMTP connections for burst sending
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  return _transporter;
}

const brevoAdapter = {
  async sendMail({ to, subject, html, text }) {
    const transporter = getTransporter();

    const info = await transporter.sendMail({
      from: `"${emailConfig.from.name}" <${emailConfig.from.address}>`,
      to,
      subject,
      html,
      text,
      // Brevo-specific header for transactional email classification
      headers: { 'X-Mailin-Tag': 'transactional' },
    });

    logger.info('[Email] Sent via Brevo SMTP', { to, subject, messageId: info.messageId });

    return { messageId: info.messageId };
  },
};

module.exports = brevoAdapter;
