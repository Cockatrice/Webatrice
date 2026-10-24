import type { TFunction } from 'i18next';

import type { NotificationInput, NotificationKind } from '@app/services';

export function entryTitle(t: TFunction, entry: NotificationInput): string {
  switch (entry.kind) {
    case 'message':
      return entry.actor ?? '';
    case 'mention':
      return entry.place
        ? t('Notifications.title.mentionIn', { sender: entry.actor, room: entry.place })
        : t('Notifications.title.mention', { sender: entry.actor });
    case 'buddy':
      return t('Notifications.title.buddy', { name: entry.actor });
    case 'game':
      return t('Notifications.title.game', { game: entry.place });
    default:
      return entry.title ?? '';
  }
}

export function entryBody(t: TFunction, entry: NotificationInput): string | undefined {
  if (entry.kind === 'game' && entry.seats) {
    return t('Notifications.body.seats', { taken: entry.seats.taken, max: entry.seats.max });
  }
  return entry.body;
}

export function systemTitle(t: TFunction, entry: NotificationInput): string {
  return entry.kind === 'message' ? t('Notifications.system.message', { sender: entry.actor }) : entryTitle(t, entry);
}

const ACTION_KEYS: Record<NotificationKind, string> = {
  message: 'Notifications.action.message',
  mention: 'Notifications.action.mention',
  buddy: 'Notifications.action.buddy',
  game: 'Notifications.action.game',
  report: 'Notifications.action.report',
};

export function actionLabel(t: TFunction, kind: NotificationKind): string {
  return t(ACTION_KEYS[kind]);
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

export function entryAge(t: TFunction, time: number, now: number): string {
  const elapsed = Math.max(0, now - time);
  if (elapsed < MINUTE) {
    return t('Notifications.age.now');
  }
  if (elapsed < HOUR) {
    return t('Notifications.age.minutes', { count: Math.floor(elapsed / MINUTE) });
  }
  return t('Notifications.age.hours', { count: Math.floor(elapsed / HOUR) });
}
