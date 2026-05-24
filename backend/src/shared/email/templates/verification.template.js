/**
 * Verification OTP email template.
 * Sent on: POST /auth/signup, POST /auth/resend-verification
 *
 * @param {{ name: string, otp: string, expiresInMinutes: number }} vars
 * @returns {{ subject: string, html: string, text: string }}
 */

const { buildHtml, buildText, otpBlock, escHtml } = require('./base.template');

function verificationTemplate({ name, otp, expiresInMinutes = 10 }) {
  const subject = `Your ${process.env.EMAIL_FROM_NAME || 'NexTalk'} verification code`;

  const bodyHtml = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;line-height:1.3;">
      Verify your email address
    </h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
      Hi ${escHtml(name)}, welcome! Enter the code below to verify your email address
      and activate your account.
    </p>

    ${otpBlock(otp)}

    <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;line-height:1.6;">
      This code expires in <strong>${expiresInMinutes} minutes</strong>.
      If you did not create an account, you can safely ignore this email.
    </p>`;

  const bodyText = [
    `Hi ${name},`,
    `Welcome to NexTalk! Please verify your email address using the code below.`,
    ``,
    `Verification code: ${otp}`,
    ``,
    `This code expires in ${expiresInMinutes} minutes.`,
    `If you did not create an account, ignore this email.`,
  ].join('\n');

  return {
    subject,
    html: buildHtml({
      title: subject,
      preheader: `Your verification code is ${otp} — expires in ${expiresInMinutes} minutes`,
      body: bodyHtml,
      footer: 'This is an automated security email. Please do not reply.',
    }),
    text: buildText({ body: bodyText }),
  };
}

module.exports = { verificationTemplate };
