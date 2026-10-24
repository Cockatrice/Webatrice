import { useTranslation } from 'react-i18next';

import { usePendingTargetContext } from '../PendingTargetContext';

export default function PendingTargetAnnouncer() {
  const { t } = useTranslation();
  const { pending } = usePendingTargetContext();
  let message = '';
  if (pending) {
    const name = pending.source.name || t('PendingTargetAnnouncer.thisCard');
    message = pending.kind === 'arrow'
      ? t('PendingTargetAnnouncer.arrow', { name })
      : t('PendingTargetAnnouncer.attach', { name });
  }
  return (
    <div aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}
