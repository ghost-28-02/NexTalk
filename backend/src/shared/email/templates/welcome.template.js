/**
 * Welcome email template.
 * Sent on: first successful POST /auth/verify-email
 *
 * @param {{ name: string }} vars
 * @returns {{ subject: string, html: string, text: string }}
 */

const { buildHtml, buildText, ctaButton, escHtml } = require('./base.template');

const APP_NAME   = process.env.EMAIL_FROM_NAME || 'NexTalk';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://nextalk.app';

function welcomeTemplate({ name }) {
  const subject = `Welcome to ${APP_NAME}! Your account is ready.`;

  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;line-height:1.3;">
      You're in, ${escHtml(name)}! 🎉
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">
      Your email is verified and your ${escHtml(APP_NAME)} account is ready to use.
      Start connecting with friends and teammates in real time.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="margin-bottom:24px;">
      ${featureRow('💬', 'Real-time messaging', 'Send messages that arrive instantly — no refresh needed.')}
      ${featureRow('📞', 'Voice & video calls', 'Crystal-clear calls built right into your conversations.')}
      ${featureRow('👥', 'Group chats', 'Create rooms for your teams, friends, or communities.')}
    </table>

    ${ctaButton({ url: FRONTEND_URL, label: `Open ${APP_NAME}` })}

    <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;line-height:1.6;">
      Have questions? Reply to this email — we&apos;re happy to help.
    </p>`;

  const bodyText = [
    `Hi ${name},`,
    ``,
    `Welcome to ${APP_NAME}! Your email has been verified and your account is ready.`,
    ``,
    `Get started: ${FRONTEND_URL}`,
    ``,
    `What you can do:`,
    `- Real-time messaging`,
    `- Voice & video calls`,
    `- Group chats`,
    ``,
    `Have questions? Just reply to this email.`,
  ].join('\n');

  return {
    subject,
    html: buildHtml({
      title:     subject,
      preheader: `Your ${APP_NAME} account is active — start chatting now!`,
      body:      bodyHtml,
    }),
    text: buildText({ body: bodyText }),
  };
}

function featureRow(emoji, title, description) {
  return `
    <tr>
      <td style="padding:10px 0;vertical-align:top;width:32px;font-size:20px;">${emoji}</td>
      <td style="padding:10px 0 10px 12px;vertical-align:top;">
        <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${escHtml(title)}</p>
        <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">${escHtml(description)}</p>
      </td>
    </tr>`;
}

module.exports = { welcomeTemplate };
