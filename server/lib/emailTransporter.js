import nodemailer from 'nodemailer';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export const getMailFrom = () => {
  const configured = String(process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
  if (process.env.RESEND_API_KEY) {
    if (!configured || configured.toLowerCase().endsWith('@gmail.com') || configured.includes('http') || configured.includes('vercel.app')) {
      return 'onboarding@resend.dev';
    }
  }
  return configured;
};

const normalizeResendSender = (from) => {
  const raw = String(from || '').trim();
  if (!raw || raw.toLowerCase().includes('@gmail.com') || raw.includes('http') || raw.includes('vercel.app')) {
    return 'MicroJobs <onboarding@resend.dev>';
  }
  return raw;
};

// Minimal nodemailer-compatible shim so existing sendMail call sites work unchanged.
const createResendTransporter = (apiKey) => ({
  async sendMail({ from, to, subject, text, html }) {
    const sender = normalizeResendSender(from || getMailFrom());
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

  const isGmail = host === 'smtp.gmail.com' || (user && user.endsWith('@gmail.com'));
  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
  }

  const secure = port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  });
};

