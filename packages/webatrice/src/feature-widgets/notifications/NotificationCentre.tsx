import { useId, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BellOff, CheckCheck, CheckCircle2, X } from 'lucide-react';

import { Button, IconButton, useOpenNotification, useToastLaneForRoute } from '@app/components';
import { useMarkRead, useNotificationLog, useUnreadTracker } from '@app/hooks';
import type { NotificationEntry } from '@app/services';
import { RouteEnum } from '@app/types';
import { cx } from '@app/utils';

import NotificationItem from './NotificationItem';
import { filterCounts, groupEntries, NOTIFICATION_FILTERS, type NotificationFilter } from './notificationFilters';
import { useDrawerFocus, useNotificationPermission, useNow } from './useNotificationCentre';

const FILTER_KEYS: Record<NotificationFilter, string> = {
  all: 'NotificationCentre.filter.all',
  message: 'NotificationCentre.filter.message',
  mention: 'NotificationCentre.filter.mention',
  game: 'NotificationCentre.filter.game',
  buddy: 'NotificationCentre.filter.buddy',
  report: 'NotificationCentre.filter.report',
};

const PERMISSION_KEYS: Record<string, string> = {
  granted: 'NotificationCentre.permission.granted',
  default: 'NotificationCentre.permission.default',
  denied: 'NotificationCentre.permission.denied',
  unsupported: 'NotificationCentre.permission.unsupported',
};

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

export default function NotificationCentre() {
  useUnreadTracker();
  useToastLaneForRoute();
  const panel = useRef<HTMLElement>(null);
  const { open, close } = useDrawerFocus(panel);
  return open ? <NotificationDrawer panel={panel} onClose={close} /> : null;
}

function NotificationDrawer({ panel, onClose }: { panel: RefObject<HTMLElement | null>; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const headingId = useId();
  const { entries } = useNotificationLog();
  const { markNotificationsRead } = useMarkRead();
  const openNotification = useOpenNotification();
  const permission = useNotificationPermission();
  const now = useNow(true);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const counts = filterCounts(entries);
  const { fresh, earlier } = groupEntries(entries, filter);
  const unread = entries.filter((entry) => !entry.read).length;
  const onOpen = (entry: NotificationEntry) => openNotification(entry);

  return (
    <aside
      ref={panel}
      tabIndex={-1}
      aria-labelledby={headingId}
      className={cx(
        'fixed bottom-0 right-0 top-11 z-[35] flex w-[384px] max-w-full flex-col outline-none',
        'border-l border-border-subtle bg-bg-surface shadow-pop',
      )}
    >
      <header className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
        <h2 id={headingId} className="font-display text-[16px] font-semibold text-text-primary">
          {t('NotificationCentre.drawer.title')}
        </h2>
        {unread > 0 && (
          <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-semibold text-danger">
            {t('NotificationCentre.drawer.new', { count: unread })}
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          icon={<CheckCheck size={14} />}
          className="ml-auto"
          disabled={unread === 0}
          onClick={markNotificationsRead}
        >
          {t('NotificationCentre.drawer.markAllRead')}
        </Button>
        <IconButton label={t('NotificationCentre.drawer.close')} size="sm" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>
      <div
        role="group"
        aria-label={t('NotificationCentre.drawer.filters')}
        className="flex flex-wrap gap-1.5 border-b border-border-subtle px-4 py-2.5"
      >
        {NOTIFICATION_FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={cx(
              'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors',
              focusRing,
              filter === key
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border-subtle text-text-secondary hover:bg-bg-elevated',
            )}
          >
            {t(FILTER_KEYS[key])}
            <span className="tabular-nums text-text-muted">{counts[key]}</span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
        {fresh.length === 0 && earlier.length === 0 && (
          <p className="px-3 py-8 text-center text-[13px] text-text-muted">
            {t(filter === 'all' ? 'NotificationCentre.drawer.empty' : 'NotificationCentre.drawer.emptyFiltered')}
          </p>
        )}
        {fresh.length > 0 && (
          <section aria-label={t('NotificationCentre.drawer.sectionNew')}>
            <h3 className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              {t('NotificationCentre.drawer.sectionNew')}
            </h3>
            <ul className="flex flex-col gap-0.5">
              {fresh.map((entry) => <NotificationItem key={entry.id} entry={entry} now={now} onOpen={onOpen} />)}
            </ul>
          </section>
        )}
        {earlier.length > 0 && (
          <section aria-label={t('NotificationCentre.drawer.sectionEarlier')}>
            <h3 className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
              {t('NotificationCentre.drawer.sectionEarlier')}
            </h3>
            <ul className="flex flex-col gap-0.5">
              {earlier.map((entry) => <NotificationItem key={entry.id} entry={entry} now={now} onOpen={onOpen} />)}
            </ul>
          </section>
        )}
      </div>
      <footer className="flex items-center gap-2 border-t border-border-subtle px-4 py-2.5 text-[12px] text-text-muted">
        {permission === 'granted'
          ? <CheckCircle2 size={14} className="shrink-0 text-success" aria-hidden />
          : <BellOff size={14} className="shrink-0" aria-hidden />}
        <span className="min-w-0 flex-1">{t(PERMISSION_KEYS[permission])}</span>
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate(RouteEnum.SETTINGS);
          }}
          className={cx('rounded-ui-sm font-medium text-accent hover:underline', focusRing)}
        >
          {t('NotificationCentre.drawer.settings')}
        </button>
      </footer>
    </aside>
  );
}
