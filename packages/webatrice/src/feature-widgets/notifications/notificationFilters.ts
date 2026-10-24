import type { NotificationEntry, NotificationKind } from '@app/services';

export type NotificationFilter = 'all' | NotificationKind;

export const NOTIFICATION_FILTERS: readonly NotificationFilter[] = ['all', 'message', 'mention', 'game', 'buddy', 'report'];

export function filterCounts(entries: readonly NotificationEntry[]): Record<NotificationFilter, number> {
  const counts: Record<NotificationFilter, number> = { all: entries.length, message: 0, mention: 0, game: 0, buddy: 0, report: 0 };
  entries.forEach((entry) => {
    counts[entry.kind] += 1;
  });
  return counts;
}

export function groupEntries(entries: readonly NotificationEntry[], filter: NotificationFilter) {
  const shown = filter === 'all' ? entries : entries.filter((entry) => entry.kind === filter);
  return {
    fresh: shown.filter((entry) => !entry.read),
    earlier: shown.filter((entry) => entry.read),
  };
}
