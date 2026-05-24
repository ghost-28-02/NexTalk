/**
 * Password-reset success email template.
 * Sent on: POST /auth/reset-password (after successful password change)
 *
 * Security UX: lets the user know their password was changed so they can
 * act immediately if it wasn't them (change it back, contact support).
 *
 * @param {{ name: string }} vars
 * @returns {{ subject: string, html: string, text: string }}
 */

const { buildHtml, buildText, escHtml } = require('./base.template');

const APP_NAME    = process.env.EMAIL_FROM_NAME || 'NexTalk';
const SUPPORT_URL = `${process.env.FRONTEND_URL || 'https://nextalk.app'}/support`;

function passwordResetSuccessTemplate({ name }) {
  const subject = `Your ${APP_NAME} password has been changed`;

  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;line-height:1.3;">
      Password changed successfully
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">
      Hi ${escHtml(name)}, your ${escHtml(APP_NAME)} password was just updated successfully.
      All existing sessions have been signed out as a precaution — please sign in again
      with your new password.
    </p>

    <div style="padding:16px;background-color:#f0fdf4;border-radius:8px;
                border-left:4px solid #22c55e;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#166534;line-height:1.6;">
        ✓ &nbsp;Password updated<br />
        ✓ &nbsp;All sessions signed out
      </p>
    </div>

    <div style="padding:16px;background-color:#fef2f2;border-radius:8px;
                border-left:4px solid #ef4444;">
      <p style="margin:0;font-size:13px;color:#991b1b;line-height:1.6;">
        <strong>Didn&apos;t make this change?</strong>
        If you did not change your password, your account may be compromised.
        Please
        <a href="${SUPPORT_URL}" style="color:#ef4444;font-weight:600;">contact support immediately</a>.
      </p>
    </div>`;

  const bodyText = [
    `Hi ${name},`,
    ``,
    `Your ${APP_NAME} password was successfully changed.`,
    `All existing sessions have been signed out.`,
    ``,
    `If you did not make this change, your account may be compromised.`,
    `Contact support immediately: ${SUPPORT_URL}`,
  ].join('\n');

  return {
    subject,
    html: buildHtml({
      title:     subject,
      preheader: `Your ${APP_NAME} password was changed — all sessions signed out`,
      body:      bodyHtml,
      footer:    'This is an automated security email. If you did not change your password, please contact support.',
    }),
    text: buildText({ body: bodyText }),
  };
}

module.exports = { passwordResetSuccessTemplate };
