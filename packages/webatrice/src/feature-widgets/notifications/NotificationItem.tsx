import { useTranslation } from 'react-i18next';

import { actionLabel, Button, entryAge, entryBody, entryTitle, NotificationLead } from '@app/components';
import type { NotificationEntry } from '@app/services';
import { cx } from '@app/utils';

interface NotificationItemProps {
  entry: NotificationEntry;
  now: number;
  onOpen: (entry: NotificationEntry) => void;
}

export default function NotificationItem({ entry, now, onOpen }: NotificationItemProps) {
  const { t } = useTranslation();
  const unread = !entry.read;
  const body = entryBody(t, entry);
  return (
    <li className={cx('relative flex gap-3 rounded-ui px-3 py-2.5', unread && 'bg-accent/[0.06]')}>
      {unread && (
        <span className="absolute left-1 top-[22px] h-1.5 w-1.5 rounded-full bg-accent">
          <span className="sr-only">{t('NotificationCentre.drawer.unread')}</span>
        </span>
      )}
      <span className="mt-0.5">
        <NotificationLead entry={entry} size={34} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 break-words text-[13px] font-semibold leading-snug text-text-primary">
            {entryTitle(t, entry)}
          </span>
          <time className="shrink-0 text-[11px] tabular-nums text-text-muted" dateTime={new Date(entry.time).toISOString()}>
            {entryAge(t, entry.time, now)}
          </time>
        </p>
        {body && <p className="mt-0.5 line-clamp-2 break-words text-[12.5px] leading-snug text-text-secondary">{body}</p>}
        <div className="mt-1.5 flex gap-1.5">
          <Button size="sm" variant={unread ? 'secondary' : 'quiet'} onClick={() => onOpen(entry)}>
            {actionLabel(t, entry.kind)}
          </Button>
        </div>
      </div>
    </li>
  );
}
