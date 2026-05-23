/**
 * Send a marketing or hype email (default template: email-2-hype.html)
 */
async function sendMarketingEmail({ toEmail, subject, vars = {} }) {
  return sendTemplateEmail({
    toEmail,
    subject,
    templateFile: 'email-2-hype.html',
    vars,
  });
}

/**
 * Send a countdown email (default template: mail-3-countdown.html)
 */
async function sendCountdownEmail({ toEmail, subject, vars = {} }) {
  return sendTemplateEmail({
    toEmail,
    subject,
    templateFile: 'mail-3-countdown.html',
    vars,
  });
}

/**
 * Send an email using a template file from email_templates directory.
 * @param {Object} opts
 * @param {string} opts.toEmail - Recipient's email
 * @param {string} opts.subject - Email subject
 * @param {string} opts.templateFile - Template filename (e.g. 'email-1-welcome.html')
 * @param {Object} opts.vars - Variables to substitute (e.g. { name, email })
 */
async function sendTemplateEmail({ toEmail, subject, templateFile, vars = {} }) {
  const templatesDir = path.resolve(__dirname, '../../../email_templates');
  const templatePath = path.join(templatesDir, templateFile);
  let html = fs.readFileSync(templatePath, 'utf8');
  for (const [key, value] of Object.entries(vars)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\}`, 'g'), value || '');
  }
  const { transporter, config } = await createTransporter();
  const sender = config.fromName
    ? `"${config.fromName}" <${config.fromEmail}>`
    : config.fromEmail;
  const info = await transporter.sendMail({
    from: sender,
    to: toEmail,
    subject,
    html,
  });
  return {
    messageId: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
    to: toEmail,
  };
}

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const SettingsService = require('./settings.service');

// Cache the audition acknowledgement template so the file is only read once per process.
let _auditionAckTemplate = null;
function loadAuditionAckTemplate() {
  if (!_auditionAckTemplate) {
    const templatePath = path.resolve(
      __dirname,
      '../challenge/templates/audition-acknowledgement.html',
    );
    _auditionAckTemplate = fs.readFileSync(templatePath, 'utf8');
  }
  return _auditionAckTemplate;
}

function toBool(value) {
  return String(value || '').toLowerCase() === 'true';
}

async function getSmtpConfig() {
  const [
    host,
    port,
    secure,
    username,
    password,
    fromEmail,
    fromName,
  ] = await Promise.all([
    SettingsService.get('SMTP_HOST'),
    SettingsService.get('SMTP_PORT'),
    SettingsService.get('SMTP_SECURE'),
    SettingsService.get('SMTP_USERNAME'),
    SettingsService.get('SMTP_PASSWORD'),
    SettingsService.get('SMTP_FROM_EMAIL'),
    SettingsService.get('SMTP_FROM_NAME'),
  ]);

  return {
    host,
    port: Number(port || 587),
    secure: toBool(secure),
    username,
    password,
    fromEmail,
    fromName,
  };
}

function validateSmtpConfig(config) {
  if (!config.host) throw new Error('SMTP_HOST is required');
  if (!config.port || Number.isNaN(config.port)) throw new Error('SMTP_PORT must be a valid number');
  if (!config.username) throw new Error('SMTP_USERNAME is required');
  if (!config.password) throw new Error('SMTP_PASSWORD is required');
  if (!config.fromEmail) throw new Error('SMTP_FROM_EMAIL is required');
}

async function createTransporter() {
  const config = await getSmtpConfig();
  validateSmtpConfig(config);

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
  });

  await transporter.verify();
  return { transporter, config };
}

async function sendTestEmail({ toEmail, initiatedBy }) {
  const { transporter, config } = await createTransporter();
  const sender = config.fromName
    ? `"${config.fromName}" <${config.fromEmail}>`
    : config.fromEmail;

  const info = await transporter.sendMail({
    from: sender,
    to: toEmail,
    subject: 'AfroVision SMTP Test',
    text: `This is a test email from AfroVision. Initiated by ${initiatedBy || 'admin'} at ${new Date().toISOString()}.`,
    html: `
      <div style="font-family: Arial, sans-serif; background:#050A30; color:#FFFFFF; padding:24px;">
        <h2 style="margin:0 0 12px; color:#F49617;">AfroVision SMTP Test</h2>
        <p style="margin:0 0 10px; color:#F5C16C;">Your SMTP settings are working.</p>
        <p style="margin:0;">Triggered by: <strong>${initiatedBy || 'admin'}</strong></p>
        <p style="margin:8px 0 0;">Sent at: ${new Date().toISOString()}</p>
      </div>
    `,
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
  };
}

async function sendPasswordResetEmail({ toEmail, resetUrl }) {
  const { transporter, config } = await createTransporter();
  const sender = config.fromName
    ? `"${config.fromName}" <${config.fromEmail}>`
    : config.fromEmail;

  const info = await transporter.sendMail({
    from: sender,
    to: toEmail,
    subject: 'AfroVision Password Reset',
    text: [
      'We received a request to reset your AfroVision password.',
      `Reset your password here: ${resetUrl}`,
      'If you did not request this, you can ignore this email.',
    ].join('\n\n'),
    html: `
      <div style="font-family: Arial, sans-serif; background:#050A30; color:#FFFFFF; padding:24px;">
        <h2 style="margin:0 0 12px; color:#F49617;">Reset your AfroVision password</h2>
        <p style="margin:0 0 12px; color:#F5C16C;">We received a request to reset your password.</p>
        <p style="margin:0 0 20px; color:#FFFFFF;">Use the secure link below to choose a new password:</p>
        <p style="margin:0 0 20px;">
          <a href="${resetUrl}" style="display:inline-block; padding:12px 20px; border-radius:999px; background:#F49617; color:#050A30; text-decoration:none; font-weight:700;">Reset Password</a>
        </p>
        <p style="margin:0; color:#F5C16C;">If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
  };
}

// ─── Withdrawal Status Email ─────────────────────────────

/**
 * Send a branded email when a withdrawal is approved or rejected.
 *
 * @param {Object}  opts
 * @param {string}  opts.toEmail        - Recipient's email
 * @param {'approved'|'rejected'} opts.status
 * @param {number}  opts.amount         - Payout amount (₦)
 * @param {number}  opts.totalDebit     - Total debited from wallet (₦)
 * @param {number}  opts.totalFees      - Processing fees (₦)
 * @param {number}  opts.vatAmount      - VAT charged (₦)
 * @param {Object}  opts.bankDetails    - { bank_name, account_number, account_name }
 * @param {string}  [opts.displayName]  - User's display name
 */
async function sendWithdrawalStatusEmail({
  toEmail,
  status,
  amount,
  totalDebit,
  totalFees,
  vatAmount,
  bankDetails,
  displayName,
}) {
  const { transporter, config } = await createTransporter();
  const sender = config.fromName
    ? `"${config.fromName}" <${config.fromEmail}>`
    : config.fromEmail;

  const isApproved = status === 'approved';
  const subject = isApproved
    ? `Withdrawal Approved — ₦${Number(amount).toLocaleString()}`
    : `Withdrawal Declined — ₦${Number(amount).toLocaleString()}`;

  const greeting = displayName ? `Hi ${displayName},` : 'Hi,';

  const statusColor = isApproved ? '#27AE60' : '#E74C3C';
  const statusLabel = isApproved ? 'APPROVED' : 'DECLINED';
  const statusIcon = isApproved ? '✅' : '❌';

  const bodyText = isApproved
    ? `Your withdrawal request of ₦${Number(amount).toLocaleString()} has been approved and is being processed to your bank account.`
    : `Your withdrawal request of ₦${Number(amount).toLocaleString()} has been declined. The full amount of ₦${Number(totalDebit).toLocaleString()} (including fees and VAT) has been refunded to your AfroVision wallet.`;

  const bankRow = bankDetails
    ? `<tr><td style="padding:8px 0;color:#F5C16C;font-size:13px;">Bank</td><td style="padding:8px 0;color:#FFFFFF;font-size:13px;text-align:right;">${bankDetails.bank_name || '—'} · ${(bankDetails.account_number || '').slice(-4).padStart(10, '••••••')}</td></tr>`
    : '';

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;background:#050A30;color:#FFFFFF;padding:0;">
      <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
        <!-- Header -->
        <div style="text-align:center;margin-bottom:28px;">
          <h1 style="margin:0;font-size:22px;color:#F49617;letter-spacing:0.5px;">AfroVision</h1>
        </div>

        <!-- Status badge -->
        <div style="text-align:center;margin-bottom:24px;">
          <span style="display:inline-block;padding:8px 24px;border-radius:999px;background:${statusColor}22;color:${statusColor};font-weight:700;font-size:14px;letter-spacing:1px;">
            ${statusIcon} ${statusLabel}
          </span>
        </div>

        <!-- Body -->
        <p style="margin:0 0 16px;color:#F5C16C;font-size:15px;">${greeting}</p>
        <p style="margin:0 0 24px;color:#FFFFFF;font-size:14px;line-height:1.7;">${bodyText}</p>

        <!-- Breakdown table -->
        <div style="background:#0A1045;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #173A6D;">
          <table width="100%" style="border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#F5C16C;font-size:13px;">Payout Amount</td><td style="padding:8px 0;color:#FFFFFF;font-size:13px;text-align:right;font-weight:700;">₦${Number(amount).toLocaleString()}</td></tr>
            <tr><td style="padding:8px 0;color:#F5C16C;font-size:13px;">Processing Fees</td><td style="padding:8px 0;color:#FFFFFF;font-size:13px;text-align:right;">₦${Number(totalFees).toLocaleString()}</td></tr>
            <tr><td style="padding:8px 0;color:#F5C16C;font-size:13px;">VAT (7.5%)</td><td style="padding:8px 0;color:#FFFFFF;font-size:13px;text-align:right;">₦${Number(vatAmount).toLocaleString()}</td></tr>
            <tr style="border-top:1px solid #173A6D;"><td style="padding:12px 0 8px;color:#F49617;font-size:14px;font-weight:700;">Total ${isApproved ? 'Debited' : 'Refunded'}</td><td style="padding:12px 0 8px;color:#F49617;font-size:14px;font-weight:700;text-align:right;">₦${Number(totalDebit).toLocaleString()}</td></tr>
            ${bankRow}
          </table>
        </div>

        ${!isApproved ? '<p style="margin:0 0 24px;color:#FFFFFF;font-size:13px;line-height:1.6;">If you believe this was in error, please contact our support team.</p>' : '<p style="margin:0 0 24px;color:#FFFFFF;font-size:13px;line-height:1.6;">Funds typically arrive within 24 hours depending on your bank.</p>'}

        <!-- Footer -->
        <div style="text-align:center;padding-top:20px;border-top:1px solid #173A6D;">
          <p style="margin:0;color:#F5C16C55;font-size:11px;">© ${new Date().getFullYear()} AfroVision. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;

  const plainText = `${greeting}\n\n${bodyText}\n\nPayout: ₦${Number(amount).toLocaleString()}\nFees: ₦${Number(totalFees).toLocaleString()}\nVAT: ₦${Number(vatAmount).toLocaleString()}\nTotal: ₦${Number(totalDebit).toLocaleString()}\n\n— AfroVision`;

  const info = await transporter.sendMail({
    from: sender,
    to: toEmail,
    subject,
    text: plainText,
    html,
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
  };
}

// ─── Audition Signup Acknowledgement Email ─────────────────────────────

/**
 * Send acknowledgement email after paid audition signup enrollment.
 * Uses Firestore-backed settings so subject/template/recipient can be
 * adjusted without code changes.
 */
async function sendAuditionSignupAcknowledgementEmail({
  toEmail,
  displayName,
}) {
  const recipient = String(toEmail || '').trim();
  if (!recipient) {
    throw new Error('No recipient email available for audition acknowledgement');
  }

  const name = String(displayName || 'Contender').trim();

  // Load template and substitute the participant's name.
  const html = loadAuditionAckTemplate().replace(/\{\{name\}\}/g, name);

  const { transporter, config } = await createTransporter();
  const sender = config.fromName
    ? `"${config.fromName}" <${config.fromEmail}>`
    : config.fromEmail;

  const info = await transporter.sendMail({
    from: sender,
    to: recipient,
    subject: 'Your AfroVision Audition Signup is Confirmed',
    html,
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
    to: recipient,
  };
}

module.exports = {
  getSmtpConfig,
  sendTestEmail,
  sendPasswordResetEmail,
  sendWithdrawalStatusEmail,
  sendAuditionSignupAcknowledgementEmail,
};

module.exports.sendRawHtmlEmail = sendRawHtmlEmail;

/**
 * Send a pre-rendered HTML email to a single address via the configured SMTP transport.
 */
async function sendRawHtmlEmail({ toEmail, subject, html }) {
  const { transporter, config } = await createTransporter();
  const sender = config.fromName
    ? `"${config.fromName}" <${config.fromEmail}>`
    : config.fromEmail;

  const info = await transporter.sendMail({
    from: sender,
    to: toEmail,
    subject,
    html,
    text: 'Please view this email in an HTML-compatible email client.',
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
    to: toEmail,
  };
}
