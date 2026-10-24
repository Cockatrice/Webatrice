import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { server } from '@cockatrice/datatrice';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { Event_NotifyUser_NotificationType, type Event_NotifyUser, type Event_ServerShutdown } from '@cockatrice/sockatrice/generated';

import { AlertDialog, type AlertDialogSeverity } from '@app/dialogs';
import { useAppSelector } from '@app/store';
import { useReduxEffect } from '@app/hooks';
import { onSessionEnd } from '@app/services/session';

type QueuedNotice =
  | { kind: 'notification'; event: Event_NotifyUser }
  | { kind: 'closed'; reason: string };

export interface NotificationNotice {
  title: string;
  message: string;
  severity: AlertDialogSeverity;
  details?: string;
}

export function describeNotification(t: TFunction, notification: Event_NotifyUser): NotificationNotice | null {
  switch (notification.type) {
    case Event_NotifyUser_NotificationType.UNKNOWN:
      return { title: t('ServerNotices.unknown.title'), message: t('ServerNotices.unknown.message'), severity: 'info' };
    case Event_NotifyUser_NotificationType.IDLEWARNING:
      return { title: t('ServerNotices.idle.title'), message: t('ServerNotices.idle.message'), severity: 'info' };
    case Event_NotifyUser_NotificationType.PROMOTED:
      return { title: t('ServerNotices.promoted.title'), message: t('ServerNotices.promoted.message'), severity: 'info' };
    case Event_NotifyUser_NotificationType.WARNING: {
      const reason = simplified(notification.warningReason);
      return reason
        ? { title: t('ServerNotices.warning.title'), message: t('ServerNotices.warning.message', { reason }), severity: 'warning' }
        : null;
    }
    case Event_NotifyUser_NotificationType.CUSTOM: {
      const title = simplified(notification.customTitle);
      const content = simplified(notification.customContent);
      return title && content
        ? { title, message: t('ServerNotices.custom.message'), details: content, severity: 'info' }
        : null;
    }
    default:
      return null;
  }
}

function simplified(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function ServerNotices() {
  const { t } = useTranslation();
  const connectionState = useAppSelector(server.Selectors.getState);
  const previousStatus = useRef(connectionState);
  const storedShutdown = useAppSelector(server.Selectors.getServerShutdown);
  const storedNotifications = useAppSelector(server.Selectors.getNotifications);
  const [shutdown, setShutdown] = useState(() => storedShutdown);
  const [shutdownDeadline, setShutdownDeadline] = useState<number | null>(() =>
    storedShutdown ? Date.now() + storedShutdown.minutes * 60_000 : null);
  const [now, setNow] = useState(() => Date.now());
  const [notices, setNotices] = useState<QueuedNotice[]>(() =>
    storedNotifications.map((event) => ({ kind: 'notification', event })));
  const received = useRef(new WeakSet(storedNotifications));

  useReduxEffect<{ notification: Event_NotifyUser }>(({ payload: { notification } }) => {
    if (received.current.has(notification)) {
      return;
    }
    received.current.add(notification);
    if (describeNotification(t, notification)) {
      setNotices((queue) => [...queue, { kind: 'notification', event: notification }]);
    }
  }, server.Types.NOTIFY_USER, [t]);

  useReduxEffect<{ data: Event_ServerShutdown }>(({ payload: { data } }) => {
    const at = Date.now();
    setShutdown(data);
    setNow(at);
    setShutdownDeadline(at + data.minutes * 60_000);
  }, server.Types.SERVER_SHUTDOWN);

  useReduxEffect<ReturnType<typeof server.Actions.updateStatus>['payload']>(({ payload: { status } }) => {
    const wasLoggedIn = previousStatus.current === WebsocketTypes.StatusEnum.LOGGED_IN;
    previousStatus.current = status.state;
    const reason = status.description;
    if (wasLoggedIn && status.state === WebsocketTypes.StatusEnum.DISCONNECTED && reason
      && reason !== 'Connection Closed' && reason !== 'Connection Failed') {
      setNotices((queue) => [...queue, { kind: 'closed', reason }]);
    }
  }, server.Types.UPDATE_STATUS);

  useEffect(() => onSessionEnd(() => {
    setNotices((queue) => queue.filter((n) =>
      n.kind !== 'notification' || n.event.type !== Event_NotifyUser_NotificationType.IDLEWARNING));
  }), []);

  useEffect(() => {
    if (shutdownDeadline == null) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [shutdownDeadline]);

  const current = notices
    .map((entry) => ({ entry, notice: entry.kind === 'closed'
      ? { title: t('ServerNotices.closed.title'), message: entry.reason, severity: 'error' as const }
      : describeNotification(t, entry.event) }))
    .find((item): item is { entry: QueuedNotice; notice: NotificationNotice } => item.notice !== null);

  if (shutdown && shutdownDeadline != null) {
    return (
      <AlertDialog
        isOpen
        severity="info"
        title={t('ServerNotices.shutdown.title')}
        message={t('ServerNotices.shutdown.message', {
          countdown: formatCountdown(shutdownDeadline - now),
          reason: shutdown.reason,
        })}
        onDismiss={() => setShutdownDeadline(null)}
      />
    );
  }

  if (!current) {
    return null;
  }

  return (
    <AlertDialog
      isOpen
      severity={current.notice.severity}
      title={current.notice.title}
      message={current.notice.message}
      details={current.notice.details}
      onDismiss={() => {
        setNotices((queue) => queue.filter((n) => n !== current.entry));
      }}
    />
  );
}
