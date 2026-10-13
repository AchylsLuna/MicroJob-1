import JobApplication from '../models/JobApplication.js';
import { getEmailTransporter, getMailFrom } from '../lib/emailTransporter.js';
import { getWebOrigin } from '../lib/runtimeConfig.js';

export const PAYMENT_REVIEW_DEADLINE_MS = 24 * 60 * 60 * 1000;
export const PAYMENT_REVIEW_REMINDER_DELAY_MS = 12 * 60 * 60 * 1000;
const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatDeadline = (date) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
}).format(date);

export async function sendPaymentReviewReminderEmail({ application, employer, job, deadline }) {
  const transporter = getEmailTransporter();
  if (!transporter) {
    throw new Error('Payment reminder email is not configured.');
  }

  const employerName = `${employer.firstName || ''} ${employer.lastName || ''}`.trim() || 'there';
  const jobTitle = job.title || 'your job';
  const formattedDeadline = formatDeadline(deadline);
  const reviewUrl = `${getWebOrigin()}/employer/applications`;
  const text = [
    `Hi ${employerName},`,
    '',
    `The worker has submitted their work for "${jobTitle}". Please review it and approve payment or raise a dispute by ${formattedDeadline} (Asia/Manila), 24 hours after submission.`,
    '',
    `Review the submission: ${reviewUrl}`,
    '',
    'This is an automated reminder from MicroJobs.',
  ].join('\n');

  await transporter.sendMail({
    from: `MicroJobs <${getMailFrom()}>`,
    to: employer.email,
    subject: `Action needed: review submitted work for ${jobTitle}`,
    text,
    html: `
      <div style="max-width: 620px; margin: 0 auto; font-family: Arial, sans-serif; color: #102a43;">
        <div style="padding: 24px; background: #1c4d8d; color: #ffffff;">
          <div style="font-size: 20px; font-weight: 700;">MicroJobs</div>
          <div style="margin-top: 6px; font-size: 16px;">Payment review reminder</div>
        </div>
        <div style="padding: 24px; border: 1px solid #d9e2ec; border-top: 0;">
          <p>Hi ${escapeHtml(employerName)},</p>
          <p>The worker has submitted their work for <strong>${escapeHtml(jobTitle)}</strong>.</p>
          <p>Please review the submission and approve payment or raise a dispute by <strong>${escapeHtml(formattedDeadline)} (Asia/Manila)</strong>. This deadline is 24 hours after submission.</p>
          <p><a href="${escapeHtml(reviewUrl)}" style="display: inline-block; padding: 12px 18px; border-radius: 6px; background: #1c4d8d; color: #ffffff; text-decoration: none;">Review submitted work</a></p>
          <p style="color: #52606d; font-size: 13px;">This is an automated reminder from MicroJobs.</p>
        </div>
      </div>`,
  });

  return { applicationId: String(application._id) };
}

export async function sendDuePaymentReviewReminders({
  now = new Date(),
  sendEmail = sendPaymentReviewReminderEmail,
} = {}) {
  const reminderCutoff = new Date(now.getTime() - PAYMENT_REVIEW_REMINDER_DELAY_MS);
  const deadlineCutoff = new Date(now.getTime() - PAYMENT_REVIEW_DEADLINE_MS);
  const staleClaimCutoff = new Date(now.getTime() - CLAIM_TIMEOUT_MS);
  const candidates = await JobApplication.find({
    status: 'Hired',
    workStatus: 'Submitted',
    paymentStatus: { $in: ['Secured', 'Authorized', 'Failed'] },
    workSubmittedAt: { $lte: reminderCutoff, $gt: deadlineCutoff },
    paymentReminderSentAt: null,
  }).select('_id').lean();

  let sent = 0;
  for (const candidate of candidates) {
    const application = await JobApplication.findOneAndUpdate(
      {
        _id: candidate._id,
        status: 'Hired',
        workStatus: 'Submitted',
        paymentStatus: { $in: ['Secured', 'Authorized', 'Failed'] },
        workSubmittedAt: { $lte: reminderCutoff, $gt: deadlineCutoff },
        paymentReminderSentAt: null,
        $or: [
          { paymentReminderClaimedAt: null },
          { paymentReminderClaimedAt: { $lte: staleClaimCutoff } },
        ],
      },
      { $set: { paymentReminderClaimedAt: now } },
      { returnDocument: 'after' },
    );
    if (!application) continue;

    try {
      await application.populate([
        { path: 'job', select: 'title jobPoster', populate: { path: 'jobPoster', select: 'firstName lastName email' } },
      ]);
      if (!application.job?.jobPoster?.email) {
        throw new Error(`Employer email is unavailable for application ${application._id}.`);
      }
      const deadline = new Date(application.workSubmittedAt.getTime() + PAYMENT_REVIEW_DEADLINE_MS);
      await sendEmail({
        application,
        employer: application.job.jobPoster,
        job: application.job,
        deadline,
      });
      await JobApplication.updateOne(
        { _id: application._id, paymentReminderClaimedAt: now },
        { $set: { paymentReminderSentAt: now }, $unset: { paymentReminderClaimedAt: 1 } },
      );
      sent += 1;
    } catch (error) {
      await JobApplication.updateOne(
        { _id: application._id, paymentReminderClaimedAt: now },
        { $unset: { paymentReminderClaimedAt: 1 } },
      );
      throw error;
    }
  }

  return { sent, checked: candidates.length };
}
