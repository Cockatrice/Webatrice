import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';

import { IconButton } from '@app/components';
import { useNotificationDrawer, useUnreadCounts } from '@app/hooks';

import { BELL_ATTRIBUTE } from './useNotificationCentre';

const MAX_BADGE = 99;

export default function NotificationBell() {
  const { t } = useTranslation();
  const { open, setOpen } = useNotificationDrawer();
  const notifications = useUnreadCounts((counts) => counts.notifications);
  const label = notifications > 0
    ? t('NotificationCentre.bell.labelUnread', { count: notifications })
    : t('NotificationCentre.bell.label');
  return (
    <span className="relative inline-flex shrink-0" {...{ [BELL_ATTRIBUTE]: '' }}>
      <IconButton label={label} active={open} aria-pressed={undefined} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell size={18} />
      </IconButton>
      {notifications > 0 && (
        <span
          aria-hidden
          className={[
            'pointer-events-none absolute -right-0.5 -top-0.5 inline-flex h-[17px] min-w-[17px] items-center justify-center',
            'rounded-full border-2 border-bg-surface bg-danger px-0.5 text-[9.5px] font-bold tabular-nums text-on-accent',
          ].join(' ')}
        >
          {notifications > MAX_BADGE ? `${MAX_BADGE}+` : notifications}
        </span>
      )}
    </span>
  );
}
