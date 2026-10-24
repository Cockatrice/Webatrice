import type { MentionCounts, NotificationKind, NotificationState } from './notificationStore';

export interface UnreadCounts {
  rooms: Readonly<Record<number, number>>;
  games: Readonly<Record<number, number>>;
  chats: Readonly<Record<string, number>>;
  mentions: MentionCounts;
  notifications: number;
  total: number;
}

const sum = (counts: Readonly<Record<string | number, number>>) => Object.values(counts).reduce((a, n) => a + n, 0);

const OUTSIDE_SESSIONS: ReadonlySet<NotificationKind> = new Set(['buddy', 'report']);

let cached: { state: NotificationState; counts: UnreadCounts } | null = null;

export function selectUnreadCounts(state: NotificationState): UnreadCounts {
  if (cached?.state === state) {
    return cached.counts;
  }
  const unread = state.entries.filter((entry) => !entry.read);
  const unreadOutsideSessions = unread.filter((entry) => OUTSIDE_SESSIONS.has(entry.kind)).length;
  const counts: UnreadCounts = {
    rooms: state.rooms,
    games: state.games,
    chats: state.chats,
    mentions: state.mentions,
    notifications: unread.length,
    total: sum(state.rooms) + sum(state.games) + sum(state.chats) + unreadOutsideSessions,
  };
  cached = { state, counts };
  return counts;
}
