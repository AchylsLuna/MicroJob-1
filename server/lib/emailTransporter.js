import nodemailer from 'nodemailer';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export const getMailFrom = () =>
  process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || '';

// Minimal nodemailer-compatible shim so existing sendMail call sites work unchanged.
const createResendTransporter = (apiKey) => ({
  async sendMail({ from, to, subject, text, html }) {
    const sender = from || getMailFrom();
    if (!sender) {
      throw new Error('No sender address configured. Set MAIL_FROM to a Resend-verified address.');
    }
    const recipients = Array.isArray(to) ? to : [to];
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: sender,
        to: recipients,
        subject,
        ...(text ? { text } : {}),
        ...(html ? { html } : {}),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Resend rejected the email (${response.status}): ${payload?.message || 'unknown error'}`);
    }
    return { messageId: payload?.id, accepted: recipients, rejected: [] };
  },
});

export const getEmailTransporter = () => {
  // Prefer a real transactional provider. Consumer mailboxes silently drop
  // verification-code emails sent from an unauthenticated personal account.
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    return createResendTransporter(resendApiKey);
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    return null;
  }

  const secure = port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};
