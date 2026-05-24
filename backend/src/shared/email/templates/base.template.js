/**
 * Base email template — branded HTML wrapper for all transactional emails.
 *
 * Design principles:
 *   - Table-based layout: the only reliable approach across all email clients
 *     (Outlook 2016 uses Word's HTML renderer; floats and flexbox don't work)
 *   - Inline CSS everywhere except the <style> block for mobile media queries
 *   - Dark-mode aware via @media (prefers-color-scheme: dark) in <style>
 *   - Plain-text equivalent always required (spam filters penalise HTML-only emails)
 *
 * Usage:
 *   const { buildHtml, buildText } = require('./base.template');
 *   const html = buildHtml({ title: 'Verify your email', body: innerHtml });
 *   const text = buildText({ preheader: '...', body: plainText });
 */

const APP_NAME    = process.env.EMAIL_FROM_NAME    || 'NexTalk';
const BRAND_COLOR = '#6366f1'; // Indigo-500 — matches the frontend primary
const MUTED_COLOR = '#6b7280';
const BG_COLOR    = '#f9fafb';
const CARD_BG     = '#ffffff';
const TEXT_COLOR  = '#111827';

/**
 * Wrap inner HTML in the branded shell.
 *
 * @param {object} opts
 * @param {string} opts.title      — <title> and preview text
 * @param {string} opts.preheader  — Preview text (hidden, shown in inbox snippet)
 * @param {string} opts.body       — Inner HTML content (headings, paragraphs, buttons, etc.)
 * @param {string} [opts.footer]   — Optional extra footer text
 * @returns {string} Full HTML email string
 */
function buildHtml({ title, preheader = '', body, footer = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escHtml(title)}</title>
  <style>
    /* Prevent iOS from auto-linking phone numbers */
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }

    /* Responsive single-column layout */
    @media only screen and (max-width: 600px) {
      .email-wrapper { width: 100% !important; }
      .email-card    { border-radius: 0 !important; padding: 24px 20px !important; }
    }

    /* Dark mode overrides (Apple Mail, Outlook.com) */
    @media (prefers-color-scheme: dark) {
      .email-bg   { background-color: #0f172a !important; }
      .email-card { background-color: #1e293b !important; }
      .email-text { color: #e2e8f0 !important; }
      .email-muted { color: #94a3b8 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Preheader text (hidden in body, visible in inbox snippet) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${escHtml(preheader)}&nbsp;&#847;&zwnj;&#847;&zwnj;&#847;&zwnj;
  </div>

  <!-- Outer wrapper table -->
  <table class="email-bg" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="background-color:${BG_COLOR};padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card table -->
        <table class="email-wrapper email-card" role="presentation" cellpadding="0" cellspacing="0" border="0"
               width="560" style="background-color:${CARD_BG};border-radius:12px;padding:40px 48px;
               box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td>

              <!-- Logo / brand header -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                     style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-flex;align-items:center;gap:8px;">
                      <div style="width:36px;height:36px;background-color:${BRAND_COLOR};border-radius:8px;
                                  display:inline-block;vertical-align:middle;line-height:36px;text-align:center;">
                        <span style="color:#fff;font-size:18px;font-weight:700;line-height:36px;">N</span>
                      </div>
                      <span style="font-size:20px;font-weight:700;color:${TEXT_COLOR};vertical-align:middle;
                                   margin-left:8px;">${escHtml(APP_NAME)}</span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Body content injected here -->
              <div class="email-text" style="color:${TEXT_COLOR};">
                ${body}
              </div>

              <!-- Divider -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                     style="margin:32px 0;">
                <tr>
                  <td style="border-top:1px solid #e5e7eb;"></td>
                </tr>
              </table>

              <!-- Footer -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" class="email-muted"
                      style="font-size:12px;color:${MUTED_COLOR};line-height:1.6;">
                    ${footer || `You received this email because you have an account with ${escHtml(APP_NAME)}.`}
                    <br />
                    &copy; ${new Date().getFullYear()} ${escHtml(APP_NAME)}. All rights reserved.
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table><!-- /card -->

      </td>
    </tr>
  </table><!-- /outer -->

</body>
</html>`;
}

/**
 * Build a consistent plain-text fallback.
 * Called alongside buildHtml — both are always sent together.
 *
 * @param {string} body — plain text content (no HTML)
 * @returns {string}
 */
function buildText({ body }) {
  return [
    APP_NAME,
    '─'.repeat(40),
    body,
    '─'.repeat(40),
    `© ${new Date().getFullYear()} ${APP_NAME}`,
  ].join('\n\n');
}

/** Minimal HTML entity escaping for template string interpolation. */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Reusable CTA button HTML.
 * @param {{ url: string, label: string, color?: string }} opts
 */
function ctaButton({ url, label, color = BRAND_COLOR }) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
      <tr>
        <td align="center" style="border-radius:8px;background-color:${color};">
          <a href="${url}" target="_blank"
             style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;
                    color:#ffffff;text-decoration:none;border-radius:8px;
                    mso-padding-alt:14px 32px;line-height:1;">
            ${escHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

/**
 * Large OTP display block.
 * @param {string} otp
 */
function otpBlock(otp) {
  return `
    <div style="margin:28px auto;text-align:center;">
      <div style="display:inline-block;background-color:#f3f4f6;border-radius:10px;
                  padding:20px 36px;">
        <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:${BRAND_COLOR};
                     font-family:'Courier New',Courier,monospace;">${escHtml(otp)}</span>
      </div>
      <p style="margin:12px 0 0;font-size:13px;color:${MUTED_COLOR};">
        Enter this code in the app. Do not share it with anyone.
      </p>
    </div>`;
}

module.exports = { buildHtml, buildText, ctaButton, otpBlock, escHtml };
