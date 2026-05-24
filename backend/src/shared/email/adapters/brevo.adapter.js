/**
 * Brevo API Adapter — production email transport.
 *
 * Uses Brevo's transactional email REST API instead of SMTP.
 * Endpoint: POST https://api.brevo.com/v3/smtp/email
 *
 * Interface contract:
 *   sendMail({ to, subject, html, text }) → Promise<{ messageId: string }>
 */

const { emailConfig } = require('../../../config/email.config');
const { logger } = require('../../../shared/utils/logger');

async function sendBrevoEmail({ to, subject, html, text }) {
  if (!emailConfig.apiKey) {
    throw new Error('BREVO_API_KEY is missing');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': emailConfig.apiKey,
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: emailConfig.from.name,
        email: emailConfig.from.address,
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
      headers: {
        'X-Mailin-Tag': 'transactional',
      },
    }),
  });

  const responseText = await response.text();
  const payload = responseText ? JSON.parse(responseText) : {};

  if (!response.ok) {
    const errorMessage = payload?.message || payload?.code || responseText || 'Brevo API request failed';
    throw new Error(errorMessage);
  }

  const messageId = payload?.messageId || payload?.messageIds?.[0] || `brevo-${Date.now()}`;

  logger.info('[Email] Sent via Brevo API', { to, subject, messageId });

  return { messageId };
}

const brevoAdapter = {
  sendMail: sendBrevoEmail,
};

module.exports = brevoAdapter;