const sgMail = require('@sendgrid/mail');

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'notifications@afrovision.tv';
const FROM_NAME = process.env.FROM_NAME || 'AfroVision';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

/**
 * Send an email via SendGrid.
 * Silently returns false if no API key is configured.
 */
async function sendEmail({ to, subject, text, html }) {
  if (!SENDGRID_API_KEY) {
    console.warn('[Email] SENDGRID_API_KEY not set — skipping email to', to);
    return false;
  }
  try {
    await sgMail.send({
      to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    return false;
  }
}

/**
 * Send a program reminder email.
 */
async function sendReminderEmail({ to, programTitle, channelName, channelId }) {
  const liveUrl = `https://afrovision-website-134538542038.us-central1.run.app/live/${channelId}`;
  const subject = `🔔 "${programTitle}" is starting soon on ${channelName}!`;
  const text = `Your reminder: "${programTitle}" on ${channelName} is about to start!\n\nWatch now: ${liveUrl}`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #050A30; border-radius: 16px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #173A6D 0%, #050A30 100%); padding: 32px 24px; text-align: center;">
        <h1 style="color: #F5C16C; font-size: 20px; margin: 0 0 8px;">🔔 Show Starting Soon!</h1>
        <p style="color: #FFFFFF; font-size: 16px; font-weight: 600; margin: 0;">"${programTitle}"</p>
        <p style="color: #8899bb; font-size: 13px; margin: 8px 0 0;">on ${channelName}</p>
      </div>
      <div style="padding: 24px; text-align: center;">
        <a href="${liveUrl}" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #F49617, #F5C16C); color: #050A30; font-weight: 700; font-size: 14px; border-radius: 10px; text-decoration: none;">Watch Now</a>
        <p style="color: #8899bb; font-size: 11px; margin: 16px 0 0;">You received this because you set a reminder on AfroVision.</p>
      </div>
    </div>
  `;
  return sendEmail({ to, subject, text, html });
}

/**
 * Send an exclusive lifecycle email (activation, renewal, reminder, expiry, ops).
 */
async function sendExclusiveLifecycleEmail({
  to,
  subject,
  title,
  body,
  ctaUrl,
  ctaLabel = 'Open AfroVision',
  footer = 'You are receiving this email because of your AfroVision account activity.',
}) {
  const safeTitle = String(title || 'Exclusive Channel Update');
  const safeBody = String(body || 'There is an update to your exclusive channel access.');
  const safeLabel = String(ctaLabel || 'Open AfroVision');
  const safeFooter = String(footer || 'You are receiving this email because of your AfroVision account activity.');

  const text = `${safeTitle}\n\n${safeBody}${ctaUrl ? `\n\nOpen: ${ctaUrl}` : ''}`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #050A30; border-radius: 16px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #173A6D 0%, #050A30 100%); padding: 28px 24px; text-align: center;">
        <h1 style="color: #F5C16C; font-size: 20px; margin: 0 0 6px;">${safeTitle}</h1>
        <p style="color: #FFFFFF; font-size: 14px; margin: 0; line-height: 1.5;">${safeBody}</p>
      </div>
      <div style="padding: 24px; text-align: center;">
        ${ctaUrl
          ? `<a href="${ctaUrl}" style="display: inline-block; padding: 13px 32px; background: linear-gradient(135deg, #F49617, #F5C16C); color: #050A30; font-weight: 700; font-size: 14px; border-radius: 10px; text-decoration: none;">${safeLabel}</a>`
          : ''}
        <p style="color: #8899bb; font-size: 11px; margin: 16px 0 0; line-height: 1.4;">${safeFooter}</p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject: subject || safeTitle, text, html });
}

module.exports = { sendEmail, sendReminderEmail, sendExclusiveLifecycleEmail };
