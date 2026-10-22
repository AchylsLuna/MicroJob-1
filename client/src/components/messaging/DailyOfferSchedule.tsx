import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import type { ChatMessage } from '../../contexts/MessagingContext';
import { DailyWorkSchedule } from '../DailyWorkSchedule';
import { WorkSubmission } from '../WorkSubmission';
import { formatCurrency } from '../../lib/formatters';

export function DailyOfferSchedule({ message }: { message: ChatMessage }) {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const attachment = message.attachment;
  const application = attachment?.application;
  if (!attachment?.workDates?.length) return null;
  return <div className="space-y-3">
    <DailyWorkSchedule dates={attachment.workDates} rate={Number(attachment.dailyAmount)} start={attachment.workStartTime} end={attachment.workEndTime} />
    <p className="text-sm font-semibold">{t('lifecycle.agreed')}: {formatCurrency(attachment.totalAmount || 0)}</p>
    {user?.id === message.receiver._id && typeof application === 'object' && application.workStatus === 'In Progress' && application.paymentStatus !== 'Paid' && <WorkSubmission applicationId={application._id} onChanged={() => window.dispatchEvent(new Event('microjobs:lifecycle'))} />}
  </div>;
}
