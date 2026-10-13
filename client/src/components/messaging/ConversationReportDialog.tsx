import { useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Select, Textarea } from '../ui';
import { reportConversation, type MessageReportCategory } from '../../services/api';
import { toast } from '../../lib/toast';
import type { Contact } from '../../contexts/MessagingContext';

export function ConversationReportDialog({ contact, onClose, restoreFocusRef }: {
  contact: Pick<Contact, 'otherUserId' | 'otherUserName' | 'jobId'>;
  onClose: () => void;
  restoreFocusRef?: RefObject<HTMLButtonElement | null>;
}) {
  const { t } = useTranslation('worker');
  const [category, setCategory] = useState<MessageReportCategory | ''>('');
  const [details, setDetails] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const reasonRef = useRef<HTMLSelectElement>(null);

  const submit = async () => {
    if (!category || pending) return;
    setPending(true);
    setError('');
    try {
      const result = await reportConversation({ otherUserId: contact.otherUserId, jobId: contact.jobId, category, details: details.trim() });
      toast.success(t(result.alreadyPending ? 'messages.report.alreadyPending' : 'messages.report.success'));
      onClose();
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : t('messages.report.failed'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open title={t('messages.report.title', { name: contact.otherUserName })} description={t('messages.report.description')} onClose={() => !pending && onClose()} closeDisabled={pending} initialFocusRef={reasonRef} restoreFocusRef={restoreFocusRef}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <Select ref={reasonRef} label={t('messages.report.reason')} value={category} disabled={pending} required onChange={(event) => setCategory(event.target.value as MessageReportCategory)}>
          <option value="" disabled>{t('messages.report.chooseReason')}</option>
          {(['abuse', 'scam', 'threats', 'other'] as const).map((reason) => <option key={reason} value={reason}>{t(`messages.report.reasons.${reason}`)}</option>)}
        </Select>
        <Textarea label={t('messages.report.details')} value={details} maxLength={1500} rows={3} disabled={pending} onChange={(event) => setDetails(event.target.value)} />
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t('messages.report.evidenceNotice')}</p>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={onClose} disabled={pending} className="!bg-white !text-slate-700 ring-1 ring-slate-300">{t('messages.report.cancel')}</Button>
          <Button type="submit" disabled={!category || pending} aria-busy={pending}>{t(pending ? 'messages.report.submitting' : 'messages.report.submit')}</Button>
        </div>
      </form>
    </Dialog>
  );
}
