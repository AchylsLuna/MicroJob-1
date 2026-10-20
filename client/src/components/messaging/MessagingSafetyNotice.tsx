import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function MessagingSafetyNotice() {
  const { t } = useTranslation('worker');
  return (
    <div className="flex shrink-0 items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900" role="note">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p><span className="font-semibold">{t('messages.safety.title')} </span>{t('messages.safety.description')}</p>
    </div>
  );
}
