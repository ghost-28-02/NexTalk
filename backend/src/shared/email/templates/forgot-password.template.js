/**
 * Forgot-password email template.
 * Sent on: POST /auth/forgot-password
 *
 * @param {{ name: string, resetUrl: string, expiresInHours?: number }} vars
 * @returns {{ subject: string, html: string, text: string }}
 */

const { buildHtml, buildText, ctaButton, escHtml } = require('./base.template');

const APP_NAME = process.env.EMAIL_FROM_NAME || 'NexTalk';

function forgotPasswordTemplate({ name, resetUrl, expiresInHours = 1 }) {
  const subject = `Reset your ${APP_NAME} password`;

  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;line-height:1.3;">
      Reset your password
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">
      Hi ${escHtml(name)}, we received a request to reset the password for your
      ${escHtml(APP_NAME)} account. Click the button below to choose a new password.
    </p>

    ${ctaButton({ url: resetUrl, label: 'Reset password', color: '#ef4444' })}

    <p style="margin:0 0 16px;font-size:13px;color:#6b7280;text-align:center;line-height:1.6;">
      This link expires in <strong>${expiresInHours} hour${expiresInHours !== 1 ? 's' : ''}</strong>.
    </p>

    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
      If the button above doesn&apos;t work, copy and paste this URL into your browser:
      <br />
      <a href="${resetUrl}" style="color:#6366f1;word-break:break-all;">${resetUrl}</a>
    </p>

    <div style="margin-top:24px;padding:16px;background-color:#fef2f2;border-radius:8px;
                border-left:4px solid #ef4444;">
      <p style="margin:0;font-size:13px;color:#991b1b;line-height:1.6;">
        <strong>Didn&apos;t request this?</strong> Your account is safe — no changes were made.
        You can ignore this email. If you&apos;re concerned, change your password immediately.
      </p>
    </div>`;

  const bodyText = [
    `Hi ${name},`,
    ``,
    `We received a request to reset the password for your ${APP_NAME} account.`,
    ``,
    `Reset your password: ${resetUrl}`,
    ``,
    `This link expires in ${expiresInHours} hour${expiresInHours !== 1 ? 's' : ''}.`,
    ``,
    `If you did not request this, your account is safe — ignore this email.`,
    `If you are concerned, change your password immediately.`,
  ].join('\n');

  return {
    subject,
    html: buildHtml({
      title:     subject,
      preheader: `Reset your ${APP_NAME} password — link expires in ${expiresInHours}h`,
      body:      bodyHtml,
      footer:    'You received this because a password reset was requested for your account. If you did not request this, ignore this email.',
    }),
    text: buildText({ body: bodyText }),
  };
}

module.exports = { forgotPasswordTemplate };
