import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { requestStaffSecondaryEmailOtp, confirmStaffSecondaryEmailOtp, type StaffSecondaryEmailStatus } from '../../services/api';
import { toast } from '../../lib/toast';

type Props = {
  status: StaffSecondaryEmailStatus | null;
  error: string;
  onRetry: () => void;
  onVerified: (status: StaffSecondaryEmailStatus) => void;
};
const fieldClass = 'w-full mt-2 bg-white border border-slate-200 rounded-xl px-4 py-3 text-body outline-none focus:ring-2 focus:ring-brand disabled:opacity-60';
const buttonClass = 'px-5 py-2.5 bg-brand text-white rounded-full text-body-sm font-semibold disabled:opacity-60';

export function StaffSecondaryEmail({ status, error, onRetry, onVerified }: Props) {
  const { t } = useTranslation('admin');
  const [email, setEmail] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [code, setCode] = useState('');
  const [requestedEmail, setRequestedEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const draft = email ?? status?.email ?? '';
  const verified = Boolean(status?.verified && draft.trim().toLowerCase() === status.email);

  const send = async () => {
    setBusy(true);
    try {
      const target = draft.trim().toLowerCase();
      await requestStaffSecondaryEmailOtp({ email: target, currentPassword });
      setRequestedEmail(target);
      setCode('');
      toast.success(t('secondaryEmail.sent'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('secondaryEmail.sendFailed'));
    } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true);
    try {
      const updated = await confirmStaffSecondaryEmailOtp({ email: requestedEmail, code });
      onVerified(updated);
      setEmail(updated.email);
      setCurrentPassword('');
      setRequestedEmail('');
      setCode('');
      toast.success(t('secondaryEmail.verified'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('secondaryEmail.verifyFailed'));
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-4 border-t border-slate-200 pt-6" aria-labelledby="staff-secondary-email-label">
      <div>
        <label id="staff-secondary-email-label" htmlFor="staff-secondary-email" className="text-body font-medium text-slate-600 block">{t('secondaryEmail.label')}</label>
        <p id="staff-secondary-email-help" className="text-body-sm text-slate-500 mt-1">{t('secondaryEmail.description')}</p>
        {status?.verified && <p className="text-body-sm text-slate-600 mt-2 break-all">{t('secondaryEmail.active', { email: status.email })}</p>}
        <input id="staff-secondary-email" type="email" autoComplete="email" maxLength={254} value={draft}
          aria-describedby="staff-secondary-email-help" disabled={!status || busy}
          onChange={(event) => { setEmail(event.target.value); setRequestedEmail(''); setCode(''); }} className={fieldClass} />
        <p role="status" className="text-body-sm text-slate-600 mt-2 flex items-center gap-2">
          {verified && <CheckCircle2 className="h-4 w-4 text-brand" aria-hidden="true" />}
          {verified ? t('secondaryEmail.verified') : status ? t('secondaryEmail.unverified') : error ? '' : t('secondaryEmail.loading')}
        </p>
      </div>
      {error && <div role="alert" className="text-body-sm text-slate-600"><p>{error}</p><button type="button" className={buttonClass} onClick={onRetry}>{t('secondaryEmail.retry')}</button></div>}
      {status && !verified && <>
        <div>
          <label htmlFor="staff-secondary-current-password" className="text-body-sm text-slate-500">{t('secondaryEmail.password')}</label>
          <input id="staff-secondary-current-password" type="password" autoComplete="current-password" value={currentPassword}
            disabled={busy} onChange={(event) => setCurrentPassword(event.target.value)} className={fieldClass} />
        </div>
        <button type="button" className={buttonClass} onClick={() => void send()} disabled={busy || !draft.trim() || !currentPassword}>
          {busy ? t('secondaryEmail.working') : requestedEmail ? t('secondaryEmail.resend') : t('secondaryEmail.send')}
        </button>
        {requestedEmail && <div className="space-y-3">
          <label htmlFor="staff-secondary-email-code" className="text-body-sm text-slate-500 block">{t('secondaryEmail.code')}</label>
          <input id="staff-secondary-email-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={busy}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className={fieldClass} />
          <button type="button" className={buttonClass} onClick={() => void verify()} disabled={busy || code.length !== 6}>{t('secondaryEmail.verify')}</button>
        </div>}
      </>}
    </section>
  );
}
